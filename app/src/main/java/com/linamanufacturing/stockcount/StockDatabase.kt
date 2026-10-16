package com.linamanufacturing.stockcount

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import org.json.JSONObject
import org.json.JSONTokener
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

internal class StockDatabase(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(true)
        db.rawQuery("PRAGMA secure_delete = ON", null).use { }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE stock_data (
                data_key TEXT PRIMARY KEY NOT NULL,
                nonce BLOB NOT NULL,
                ciphertext BLOB NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion != newVersion) {
            throw IllegalStateException("Unsupported stock database upgrade: $oldVersion to $newVersion")
        }
    }

    @Synchronized
    fun read(key: String): String? {
        readableDatabase.rawQuery(
            "SELECT nonce, ciphertext FROM stock_data WHERE data_key = ?",
            arrayOf(key)
        ).use { cursor ->
            if (!cursor.moveToFirst()) return null
            val nonce = cursor.getBlob(0)
            val encrypted = cursor.getBlob(1)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), GCMParameterSpec(128, nonce))
            cipher.updateAAD(key.toByteArray(StandardCharsets.UTF_8))
            return String(cipher.doFinal(encrypted), StandardCharsets.UTF_8)
        }
    }

    @Synchronized
    fun write(key: String, value: String) {
        validateJson(value)
        storeEncrypted(writableDatabase, key, value)
    }

    @Synchronized
    fun replaceAll(masterJson: String, sessionJson: String) {
        validateSession(masterJson, sessionJson)
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.delete(TABLE_NAME, null, null)
            storeEncrypted(db, APP_MASTER_KEY, masterJson)
            storeEncrypted(db, APP_SESSION_KEY, sessionJson)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    @Synchronized
    fun importSession(masterJson: String, sessionJson: String) {
        validateSession(masterJson, sessionJson)
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.delete(TABLE_NAME, "data_key IN (?, ?)", arrayOf(APP_MASTER_KEY, APP_SESSION_KEY))
            storeEncrypted(db, APP_MASTER_KEY, masterJson)
            storeEncrypted(db, APP_SESSION_KEY, sessionJson)
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    @Synchronized
    fun remove(key: String) {
        writableDatabase.delete(TABLE_NAME, "data_key = ?", arrayOf(key))
    }

    @Synchronized
    fun keys(): List<String> {
        val result = mutableListOf<String>()
        readableDatabase.rawQuery(
            "SELECT data_key FROM stock_data ORDER BY data_key",
            null
        ).use { cursor ->
            while (cursor.moveToNext()) result += cursor.getString(0)
        }
        return result
    }

    private fun encryptionKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private fun storeEncrypted(db: SQLiteDatabase, key: String, value: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
        cipher.updateAAD(key.toByteArray(StandardCharsets.UTF_8))
        val encrypted = cipher.doFinal(value.toByteArray(StandardCharsets.UTF_8))
        val values = ContentValues().apply {
            put("data_key", key)
            put("nonce", cipher.iv)
            put("ciphertext", encrypted)
            put("updated_at", System.currentTimeMillis())
        }
        db.insertWithOnConflict(
            TABLE_NAME,
            null,
            values,
            SQLiteDatabase.CONFLICT_REPLACE
        ).also { rowId ->
            if (rowId == -1L) throw IllegalStateException("Could not save stock data")
        }
    }

    private fun validateJson(value: String) {
        require(value.toByteArray(StandardCharsets.UTF_8).size <= MAX_VALUE_BYTES) {
            "Stock data exceeds the storage limit"
        }
        val tokener = JSONTokener(value)
        tokener.nextValue()
        require(tokener.nextClean() == '\u0000') { "Stock data must be valid JSON" }
    }

    private fun validateSession(masterJson: String, sessionJson: String) {
        validateJson(masterJson)
        validateJson(sessionJson)
        val master = JSONTokener(masterJson).nextValue() as? JSONObject
            ?: throw IllegalArgumentException("The backup stock list is invalid")
        master.optJSONArray("items")
            ?: throw IllegalArgumentException("The backup has no stock items")
        JSONTokener(sessionJson).nextValue() as? JSONObject
            ?: throw IllegalArgumentException("The backup session is invalid")
    }

    companion object {
        private const val DATABASE_NAME = "stock-count.db"
        private const val DATABASE_VERSION = 1
        private const val TABLE_NAME = "stock_data"
        private const val KEY_ALIAS = "lina-stock-data-v1"
        private const val ANDROID_KEY_STORE = "AndroidKeyStore"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val MAX_VALUE_BYTES = 12 * 1024 * 1024
        private const val APP_MASTER_KEY = "lina-stock-count::stock-master"
        private const val APP_SESSION_KEY = "lina-stock-count::count-session"
    }
}
