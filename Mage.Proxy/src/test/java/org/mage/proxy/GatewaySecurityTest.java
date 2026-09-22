package org.mage.proxy;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewaySecurityTest {

    @Test
    void defaultPolicyAllowsOnlyLocalBrowserOrigins() {
        Gateway gateway = new Gateway(Config.parse(new String[0]), 0);

        assertTrue(gateway.originAllowed(null));
        assertTrue(gateway.originAllowed("http://localhost:5173"));
        assertTrue(gateway.originAllowed("http://127.0.0.1:8788"));
        assertFalse(gateway.originAllowed("https://attacker.example"));
        assertFalse(gateway.originAllowed("not a uri"));
    }

    @Test
    void allowsTheWindowsTauriLauncherVirtualHost() {
        Gateway gateway = new Gateway(Config.parse(new String[0]), 0);

        // WebView2 (Windows) no soporta el esquema custom tauri:// y sirve la
        // app vía el virtual host http://tauri.localhost; macOS/Linux usan
        // tauri://localhost (host ya "localhost", cubierto arriba).
        assertTrue(gateway.originAllowed("http://tauri.localhost"));
        assertTrue(gateway.originAllowed("https://tauri.localhost"));
        assertFalse(gateway.originAllowed("http://evil-tauri.localhost.attacker.example"));
    }

    @Test
    void explicitOriginsReplaceTheDefaultPolicy() {
        Config config = Config.parse(new String[]{"--allowedOrigins", "https://client.example"});
        Gateway gateway = new Gateway(config, 0);

        assertTrue(gateway.originAllowed("https://client.example"));
        assertFalse(gateway.originAllowed("http://localhost:5173"));
    }
}
