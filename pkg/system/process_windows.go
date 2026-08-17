package system

import (
	"fmt"
	"path/filepath"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	modiphlpapi = syscall.NewLazyDLL("iphlpapi.dll")
	modkernel32 = syscall.NewLazyDLL("kernel32.dll")

	procGetExtendedTcpTable        = modiphlpapi.NewProc("GetExtendedTcpTable")
	procQueryFullProcessImageNameW = modkernel32.NewProc("QueryFullProcessImageNameW")
)

const (
	tcpTableOwnerPIDAll = 5
	afInet              = 2
)

type mibTcpRowOwnerPID struct {
	State      uint32
	LocalAddr  uint32
	LocalPort  uint32
	RemoteAddr uint32
	RemotePort uint32
	OwningPID  uint32
}

type mibTcpTableOwnerPID struct {
	NumEntries uint32
	Table      [1]mibTcpRowOwnerPID
}

// FindPIDByLocalPortWindows finds the PID owning a given local TCP port on Windows.
func FindPIDByLocalPortWindows(targetPort int) (int, error) {
	var size uint32
	// First call to determine buffer size
	ret, _, _ := procGetExtendedTcpTable.Call(
		0,
		uintptr(unsafe.Pointer(&size)),
		0,
		uintptr(afInet),
		uintptr(tcpTableOwnerPIDAll),
		0,
	)

	if size == 0 {
		return 0, fmt.Errorf("GetExtendedTcpTable returned 0 size")
	}

	buf := make([]byte, size)
	ret, _, _ = procGetExtendedTcpTable.Call(
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
		0,
		uintptr(afInet),
		uintptr(tcpTableOwnerPIDAll),
		0,
	)

	if ret != 0 {
		return 0, fmt.Errorf("GetExtendedTcpTable failed with code %d", ret)
	}

	table := (*mibTcpTableOwnerPID)(unsafe.Pointer(&buf[0]))
	entries := int(table.NumEntries)

	rows := unsafe.Slice(&table.Table[0], entries)
	for i := 0; i < entries; i++ {
		// Port in table is in network byte order
		port := int(((rows[i].LocalPort & 0xFF) << 8) | ((rows[i].LocalPort >> 8) & 0xFF))
		if port == targetPort {
			return int(rows[i].OwningPID), nil
		}
	}

	return 0, fmt.Errorf("no process found for port %d", targetPort)
}

// GetProcessPathByPIDWindows retrieves the full executable path for a PID.
func GetProcessPathByPIDWindows(pid int) (string, string, error) {
	handle, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(pid))
	if err != nil {
		return "", "", err
	}
	defer windows.CloseHandle(handle)

	var buf [1024]uint16
	size := uint32(len(buf))

	r1, _, err := procQueryFullProcessImageNameW.Call(
		uintptr(handle),
		0,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(unsafe.Pointer(&size)),
	)
	if r1 == 0 {
		return "", "", err
	}

	fullPath := syscall.UTF16ToString(buf[:size])
	name := filepath.Base(fullPath)
	return name, fullPath, nil
}
