import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

/**
 * The Google OAuth *web* client id used for single sign-on.
 *
 * It is read from local.properties, which is not committed, so the id never
 * reaches the repository and a checkout on a clean machine (or on the CI
 * runner) still builds. It just builds without single sign-on, and the app
 * hides the button rather than offering one that cannot work.
 *
 * The environment variable is the escape hatch for a build server that has
 * no local.properties at all.
 */
val googleWebClientId: String = run {
    val local = rootProject.file("local.properties")
    if (local.exists()) {
        val properties = Properties()
        local.inputStream().use { properties.load(it) }
        properties.getProperty("GOOGLE_WEB_CLIENT_ID")
    } else {
        null
    } ?: System.getenv("GOOGLE_WEB_CLIENT_ID") ?: ""
}

android {
    namespace = "com.codecouture.ithrift"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.codecouture.ithrift"
        minSdk = 24
        targetSdk = 35
        versionCode = 3
        versionName = "1.2.0"

        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"$googleWebClientId\"")
    }

    /**
     * Release signing is configured from the environment, not from a file in
     * the repository. The keystore is the one secret that must never be
     * committed: anyone holding it can publish an update to the Play Store
     * under our name. .github/workflows/release.yml supplies these from
     * repository secrets; locally they are absent, and the block below is
     * skipped so a debug build still works with no set-up.
     */
    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("KEYSTORE_FILE")
            if (!keystorePath.isNullOrBlank() && file(keystorePath).exists()) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Only attach the signing config when a keystore was actually
            // provided. Attaching an empty one fails the build on a machine
            // that has no secrets, which would break every local release run.
            if (!System.getenv("KEYSTORE_FILE").isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        // Needed for GOOGLE_WEB_CLIENT_ID above; AGP 8 turns BuildConfig off by default.
        buildConfig = true
    }

    testOptions {
        unitTests {
            // Android framework calls in a JVM unit test return a default
            // value instead of throwing "not mocked". The tests under
            // src/test are written against framework-free code, so this only
            // guards against an accidental dependency taking the suite down.
            isReturnDefaultValues = true
        }
    }
}

dependencies {
    // --- AndroidX / Material core ---
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.fragment:fragment-ktx:1.8.2")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")

    // --- Networking: Retrofit + OkHttp talk to the same REST API the website and PWA use ---
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // --- Coroutines, for clean async API calls ---
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // --- Coil: loads the product images (originally generated SVGs) straight from the API ---
    implementation("io.coil-kt:coil:2.7.0")
    implementation("io.coil-kt:coil-svg:2.7.0")

    // --- Single sign-on: Credential Manager is the supported route on
    //     Android 14+, back-ported to older versions through Play Services.
    //     The older GoogleSignInClient API is deprecated. ---
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    // --- Unit tests. These run on the JVM with no emulator, which is what
    //     lets ./gradlew testDebugUnitTest finish in seconds on the CI
    //     runner. See app/src/test/. ---
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}
