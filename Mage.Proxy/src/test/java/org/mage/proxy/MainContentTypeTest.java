package org.mage.proxy;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MainContentTypeTest {

    @Test
    void servesWebAssetsWithRealMimeTypes() {
        assertEquals("text/html; charset=utf-8", Main.contentType("index.html"));
        assertEquals("application/javascript; charset=utf-8", Main.contentType("app.js"));
        assertEquals("text/css; charset=utf-8", Main.contentType("styles.css"));
        assertEquals("application/json; charset=utf-8", Main.contentType("contract.json"));
        assertEquals("image/svg+xml", Main.contentType("R.svg"));
        assertEquals("image/svg+xml", Main.contentType("R.SVG"));
        assertEquals("image/png", Main.contentType("flag.png"));
        assertEquals("image/jpeg", Main.contentType("avatar.jpg"));
        assertEquals("image/jpeg", Main.contentType("avatar.jpeg"));
        assertEquals("image/gif", Main.contentType("sprite.gif"));
        assertEquals("image/webp", Main.contentType("art.webp"));
        assertEquals("image/x-icon", Main.contentType("favicon.ico"));
        assertEquals("font/woff2", Main.contentType("font.woff2"));
        assertEquals("font/woff", Main.contentType("font.woff"));
        assertEquals("font/ttf", Main.contentType("font.ttf"));
        assertEquals("audio/wav", Main.contentType("beep.wav"));
        assertEquals("audio/mpeg", Main.contentType("beep.mp3"));
        assertEquals("application/wasm", Main.contentType("mod.wasm"));
    }

    @Test
    void fallsBackToOctetStreamForUnknownExtensions() {
        assertEquals("application/octet-stream", Main.contentType("file.bin"));
        assertEquals("application/octet-stream", Main.contentType("noext"));
    }
}
