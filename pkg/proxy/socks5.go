package proxy

import (
	"bufio"
	"crypto/tls"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"strconv"
	"time"
)

const (
	socks5Version = 0x05
	socks5NoAuth  = 0x00
	socks5Connect = 0x01
	socks5Ipv4    = 0x01
	socks5Domain  = 0x03
	socks5Ipv6    = 0x04
)

func (h *Handler) handleSOCKS5(ctx *Context, clientConn net.Conn, reader *bufio.Reader) {
	// Step 1: Handshake negotiation
	ver, err := reader.ReadByte()
	if err != nil || ver != socks5Version {
		return
	}

	nMethods, err := reader.ReadByte()
	if err != nil {
		return
	}

	methods := make([]byte, nMethods)
	if _, err := io.ReadFull(reader, methods); err != nil {
		return
	}

	// Reply with NO AUTH REQUIRED
	if _, err := clientConn.Write([]byte{socks5Version, socks5NoAuth}); err != nil {
		return
	}

	// Step 2: Read command request
	reqHeader := make([]byte, 4)
	if _, err := io.ReadFull(reader, reqHeader); err != nil {
		return
	}

	if reqHeader[1] != socks5Connect {
		// Command not supported
		_, _ = clientConn.Write([]byte{socks5Version, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
		return
	}

	var targetHost string
	addrType := reqHeader[3]

	switch addrType {
	case socks5Ipv4:
		ipv4 := make([]byte, 4)
		if _, err := io.ReadFull(reader, ipv4); err != nil {
			return
		}
		targetHost = net.IP(ipv4).String()

	case socks5Domain:
		lenByte, err := reader.ReadByte()
		if err != nil {
			return
		}
		if lenByte > 253 {
			// Domain name exceeds DNS limits; reject with ADDRESS_TYPE_NOT_SUPPORTED.
			_, _ = clientConn.Write([]byte{socks5Version, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
			return
		}
		domainBytes := make([]byte, lenByte)
		if _, err := io.ReadFull(reader, domainBytes); err != nil {
			return
		}
		targetHost = string(domainBytes)

	case socks5Ipv6:
		ipv6 := make([]byte, 16)
		if _, err := io.ReadFull(reader, ipv6); err != nil {
			return
		}
		targetHost = net.IP(ipv6).String()

	default:
		_, _ = clientConn.Write([]byte{socks5Version, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
		return
	}

	portBytes := make([]byte, 2)
	if _, err := io.ReadFull(reader, portBytes); err != nil {
		return
	}
	port := binary.BigEndian.Uint16(portBytes)
	targetAddr := net.JoinHostPort(targetHost, strconv.Itoa(int(port)))

	// Tunnel or MITM
	if port == 443 || port == 8443 {
		// Check if first bytes are TLS ClientHello (0x16 0x03 ...)
		peekBytes, err := reader.Peek(3)
		if err == nil && peekBytes[0] == 0x16 && peekBytes[1] == 0x03 &&
			h.server.Config().EnableSSL && h.server.CertManager() != nil {
			reply := []byte{socks5Version, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0}
			if _, err := clientConn.Write(reply); err != nil {
				return
			}
			tlsConfig := h.server.CertManager().TLSConfig()
			tlsClientConn := tlsServerWrap(clientConn, reader, tlsConfig)
			if err := tlsClientConn.Handshake(); err != nil {
				_ = tlsClientConn.Close()
				return
			}
			defer tlsClientConn.Close()
			tlsReader := bufio.NewReader(tlsClientConn)
			h.handleDecryptedTLS(ctx, tlsClientConn, tlsReader, targetHost, int(port))
			return
		}
	}

	remoteConn, err := net.DialTimeout("tcp", targetAddr, 10*time.Second)
	if err != nil {
		_, _ = clientConn.Write([]byte{socks5Version, 0x04, 0x00, 0x01, 0, 0, 0, 0, 0, 0})
		return
	}
	if _, err := clientConn.Write([]byte{socks5Version, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0}); err != nil {
		_ = remoteConn.Close()
		return
	}
	h.passthroughTunnelWithRemote(clientConn, remoteConn)
}

func tlsServerWrap(conn net.Conn, reader *bufio.Reader, config *tls.Config) *tls.Conn {
	return tls.Server(&bufferedConn{Conn: conn, reader: reader}, config)
}

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (b *bufferedConn) Read(p []byte) (int, error) {
	if b.reader != nil && b.reader.Buffered() > 0 {
		return b.reader.Read(p)
	}
	return b.Conn.Read(p)
}

// DialSOCKS5 establishes an upstream SOCKS5 connection to target.
func DialSOCKS5(socksAddr, targetAddr string) (net.Conn, error) {
	conn, err := net.Dial("tcp", socksAddr)
	if err != nil {
		return nil, fmt.Errorf("dial SOCKS5 server failed: %w", err)
	}

	// Handshake
	if _, err := conn.Write([]byte{socks5Version, 0x01, socks5NoAuth}); err != nil {
		conn.Close()
		return nil, err
	}

	resp := make([]byte, 2)
	if _, err := io.ReadFull(conn, resp); err != nil {
		conn.Close()
		return nil, err
	}
	if resp[0] != socks5Version || resp[1] != socks5NoAuth {
		conn.Close()
		return nil, errors.New("SOCKS5 auth rejected")
	}

	host, portStr, err := net.SplitHostPort(targetAddr)
	if err != nil {
		conn.Close()
		return nil, err
	}
	port, _ := strconv.Atoi(portStr)

	req := []byte{socks5Version, socks5Connect, 0x00, socks5Domain, byte(len(host))}
	req = append(req, []byte(host)...)
	req = append(req, byte(port>>8), byte(port&0xFF))

	if _, err := conn.Write(req); err != nil {
		conn.Close()
		return nil, err
	}

	connResp := make([]byte, 4)
	if _, err := io.ReadFull(conn, connResp); err != nil {
		conn.Close()
		return nil, err
	}
	if connResp[1] != 0x00 {
		conn.Close()
		return nil, fmt.Errorf("SOCKS5 connect failed with status 0x%x", connResp[1])
	}

	return conn, nil
}
