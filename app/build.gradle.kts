import java.security.SecureRandom
import java.util.Properties
import javax.crypto.spec.PBEKeySpec

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val authProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.isFile) file.inputStream().use { load(it) }
}
val authUsername = providers.gradleProperty("linaAuthUsername").orNull
    ?: authProperties.getProperty("lina.auth.username")
    ?: error(
        "Set lina.auth.username and lina.auth.password in local.properties " +
            "to configure the shared app login."
    )
val authPassword = providers.gradleProperty("linaAuthPassword").orNull
    ?: authProperties.getProperty("lina.auth.password")
    ?: error(
        "Set lina.auth.username and lina.auth.password in local.properties " +
            "to configure the shared app login."
    )
require(authUsername.matches(Regex("[A-Za-z0-9._@-]{3,64}"))) {
    "The shared login username must be 3-64 characters and use only letters, numbers, ., _, @ or -."
}
require(authPassword.length in 12..1024) {
    "The shared login password must be at least 12 characters."
}
val authSalt = ByteArray(16).also(SecureRandom()::nextBytes)
val passwordSpec = PBEKeySpec(
    authPassword.toCharArray(),
    authSalt,
    310_000,
    256
)
val authHash = try {
    javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        .generateSecret(passwordSpec)
        .encoded
        .joinToString("") { byte -> "%02x".format(byte) }
} finally {
    passwordSpec.clearPassword()
}
val authSaltHex = authSalt.joinToString("") { byte -> "%02x".format(byte) }

android {
    namespace = "com.linamanufacturing.stockcount"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.linamanufacturing.stockcount"
        minSdk = 29
        targetSdk = 35
        versionCode = 2
        versionName = "5.0"
        buildConfigField("String", "AUTH_USERNAME", "\"$authUsername\"")
        buildConfigField("String", "AUTH_SALT_HEX", "\"$authSaltHex\"")
        buildConfigField("String", "AUTH_HASH_HEX", "\"$authHash\"")
        buildConfigField("int", "AUTH_PBKDF2_ITERATIONS", "310000")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
        }
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.webkit:webkit:1.12.1")
}
