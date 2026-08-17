package com.httpeek.app.ui.toolbox

import android.app.Dialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.DialogFragment
import com.httpeek.app.R

class ToolboxDialog : DialogFragment() {

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val context = requireContext()
        val view = LayoutInflater.from(context).inflate(R.layout.dialog_toolbox, null)

        val spinnerTool = view.findViewById<Spinner>(R.id.spinnerTool)
        val etInput = view.findViewById<EditText>(R.id.etToolInput)
        val etParam = view.findViewById<EditText>(R.id.etToolParam)
        val btnRun = view.findViewById<Button>(R.id.btnRunTool)
        val btnCopy = view.findViewById<Button>(R.id.btnCopyResult)
        val tvOutput = view.findViewById<TextView>(R.id.tvToolOutput)

        val tools = arrayOf(
            "JWT Token Decoder",
            "URL Encoder / Decoder",
            "Base64 Encoder / Decoder",
            "MD5 / SHA-256 Hash",
            "Timestamp (Epoch <-> Date)",
            "AES Encrypt / Decrypt"
        )
        spinnerTool.adapter = ArrayAdapter(context, android.R.layout.simple_spinner_dropdown_item, tools)

        btnRun.setOnClickListener {
            val input = etInput.text.toString().trim()
            val param = etParam.text.toString().trim()

            if (input.isEmpty()) {
                tvOutput.text = "Please provide input text."
                return@setOnClickListener
            }

            when (spinnerTool.selectedItemPosition) {
                0 -> { // JWT
                    val (h, p) = ToolboxUtils.decodeJwt(input)
                    tvOutput.text = "HEADER:\n$h\n\nPAYLOAD:\n$p"
                }
                1 -> { // URL
                    val enc = ToolboxUtils.urlEncode(input)
                    val dec = ToolboxUtils.urlDecode(input)
                    tvOutput.text = "ENCODED:\n$enc\n\nDECODED:\n$dec"
                }
                2 -> { // Base64
                    val enc = ToolboxUtils.base64Encode(input)
                    val dec = ToolboxUtils.base64Decode(input)
                    tvOutput.text = "BASE64 ENCODED:\n$enc\n\nBASE64 DECODED:\n$dec"
                }
                3 -> { // Hashes
                    val md5 = ToolboxUtils.hashString(input, "MD5")
                    val sha1 = ToolboxUtils.hashString(input, "SHA-1")
                    val sha256 = ToolboxUtils.hashString(input, "SHA-256")
                    tvOutput.text = "MD5:\n$md5\n\nSHA-1:\n$sha1\n\nSHA-256:\n$sha256"
                }
                4 -> { // Timestamp
                    val epoch = input.toLongOrNull()
                    if (epoch != null) {
                        tvOutput.text = "Human Readable Date:\n${ToolboxUtils.convertEpochToDate(epoch)}"
                    } else {
                        val converted = ToolboxUtils.convertDateToEpoch(input)
                        tvOutput.text = "Epoch Milliseconds:\n$converted"
                    }
                }
                5 -> { // AES
                    val key = param.ifEmpty { "1234567890123456" }
                    val enc = ToolboxUtils.aesEncrypt(input, key)
                    val dec = ToolboxUtils.aesDecrypt(input, key)
                    tvOutput.text = "AES ENCRYPTED (Key: $key):\n$enc\n\nAES DECRYPTED (if input was b64):\n$dec"
                }
            }
        }

        btnCopy.setOnClickListener {
            val text = tvOutput.text.toString()
            if (text.isNotEmpty()) {
                val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("HTTPeek Toolbox", text))
                Toast.makeText(context, "Copied to clipboard", Toast.LENGTH_SHORT).show()
            }
        }

        return AlertDialog.Builder(context)
            .setTitle("Mobile Toolbox")
            .setView(view)
            .setPositiveButton("Close", null)
            .create()
    }
}
