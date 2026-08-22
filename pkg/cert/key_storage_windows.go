//go:build windows
// +build windows

package cert

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

func encryptDPAPI(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("data is empty")
	}

	var inBlob windows.DataBlob
	inBlob.Size = uint32(len(data))
	inBlob.Data = &data[0]

	var outBlob windows.DataBlob
	err := windows.CryptProtectData(
		&inBlob,
		windows.StringToUTF16Ptr("HTTPeek CA Master Key"),
		nil,
		0,
		nil,
		windows.CRYPTPROTECT_UI_FORBIDDEN,
		&outBlob,
	)
	if err != nil {
		return nil, err
	}
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(outBlob.Data)))

	res := make([]byte, outBlob.Size)
	copy(res, unsafe.Slice(outBlob.Data, outBlob.Size))
	return res, nil
}

func decryptDPAPI(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("data is empty")
	}

	var inBlob windows.DataBlob
	inBlob.Size = uint32(len(data))
	inBlob.Data = &data[0]

	var outBlob windows.DataBlob
	err := windows.CryptUnprotectData(
		&inBlob,
		nil,
		nil,
		0,
		nil,
		windows.CRYPTPROTECT_UI_FORBIDDEN,
		&outBlob,
	)
	if err != nil {
		return nil, err
	}
	defer windows.LocalFree(windows.Handle(unsafe.Pointer(outBlob.Data)))

	res := make([]byte, outBlob.Size)
	copy(res, unsafe.Slice(outBlob.Data, outBlob.Size))
	return res, nil
}
