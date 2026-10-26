plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ithrift.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.ithrift.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 6
        versionName = "1.3.3"
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
        /**
         * A fixed debug key, committed on purpose. A debug key is not a
         * secret (every Android SDK makes one with the same public password),
         * but each machine makes a different one, and Android refuses to
         * install an update signed with a different key over the old app.
         * Every APK built on GitHub shares this one, so each installs over
         * the last.
         */
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
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
        // The screens are written in Jetpack Compose so they can match the
        // website's design system closely (see ui/theme/ and ui/components/).
        compose = true
        // The version shown in Settings comes from BuildConfig, which AGP 8 turns off by default.
        buildConfig = true
    }

    composeOptions {
        // The Compose compiler release that pairs with Kotlin 1.9.24.
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    testOptions {
        unitTests {
            // Android framework calls in a JVM unit test return a default
            // value instead of throwing "not mocked". The tests under
            // src/test are written against framework-free code, so this only
            // guards against an accidental dependency taking the suite down.
            isReturnDefaultValues = true
            // Robolectric needs the app's resources and fonts for the screenshot test.
            isIncludeAndroidResources = true
            all {
                // The screenshot test only runs when asked for (-Pscreens=true),
                // because it needs the Node.js server running on this machine.
                it.systemProperty("screens", project.findProperty("screens") ?: "false")
                it.systemProperty("roborazzi.test.record", "true")
            }
        }
    }
}

dependencies {
    // --- AndroidX / Material core ---
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")

    // --- Jetpack Compose: every screen is a composable ---
    implementation(platform("androidx.compose:compose-bom:2024.06.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.9.1")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.4")
    debugImplementation("androidx.compose.ui:ui-tooling")

    // --- Networking: Retrofit + OkHttp talk to the same REST API the website and PWA use ---
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // --- Coroutines, for clean async API calls ---
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    // --- Coil: loads the product images (originally generated SVGs) straight from the API ---
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("io.coil-kt:coil-svg:2.7.0")

    // --- Single sign-on: Credential Manager is the supported route on
    //     Android 14+, back-ported to older versions through Play Services.
    //     The older GoogleSignInClient API is deprecated. ---
    // Google sign-in opens the website in a browser tab (see data/GoogleSignIn.kt).
    implementation("androidx.browser:browser:1.8.0")

    // --- Unit tests. These run on the JVM with no emulator, which is what
    //     lets ./gradlew testDebugUnitTest finish in seconds on the CI
    //     runner. See app/src/test/. ---
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")

    // --- Screenshot test: renders real screens on the JVM with Robolectric
    //     and saves them as images with Roborazzi. See ScreenshotTest. ---
    testImplementation(platform("androidx.compose:compose-bom:2024.06.00"))
    testImplementation("androidx.compose.ui:ui-test-junit4")
    testImplementation("androidx.test.ext:junit:1.2.1")
    testImplementation("org.robolectric:robolectric:4.12.2")
    testImplementation("io.github.takahirom.roborazzi:roborazzi:1.20.0")
    testImplementation("io.github.takahirom.roborazzi:roborazzi-compose:1.20.0")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
