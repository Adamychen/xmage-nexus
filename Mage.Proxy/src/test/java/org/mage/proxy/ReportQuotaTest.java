package org.mage.proxy;

import com.google.gson.JsonObject;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The report quota belongs to the account, not to one ProxyClient, so a re-login does not reset it. */
class ReportQuotaTest {

    private ProxyClient first;
    private ProxyClient second;

    @AfterEach
    void stop() {
        if (first != null) {
            first.shutdown();
        }
        if (second != null) {
            second.shutdown();
        }
    }

    private static WebSocket conn() {
        return (WebSocket) Proxy.newProxyInstance(WebSocket.class.getClassLoader(), new Class<?>[]{WebSocket.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("equals")) {
                        return proxy == args[0];
                    }
                    if (method.getName().equals("hashCode")) {
                        return System.identityHashCode(proxy);
                    }
                    return method.getReturnType() == boolean.class ? Boolean.TRUE : null;
                });
    }

    private boolean report(ProxyClientStreamTest.RecordingGateway gateway, ProxyClient pc, WebSocket page, String id) throws Exception {
        pc.onClientMessage(page, "{\"requestId\":\"" + id + "\",\"action\":\"report_issue\",\"args\":{\"kind\":\"bug\",\"text\":\"boom\"}}");
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            List<JsonObject> results = gateway.to(page).stream()
                    .filter(f -> "result".equals(f.get("type").getAsString()) && id.equals(f.get("requestId").getAsString()))
                    .collect(Collectors.toList());
            if (!results.isEmpty()) {
                return results.get(0).getAsJsonObject("data").get("stored").getAsBoolean();
            }
            Thread.sleep(10);
        }
        throw new AssertionError("no answer to report " + id);
    }

    @Test
    void aSecondLoginOfTheAccountDoesNotGetAFreshReportQuota(@TempDir Path dir) throws Exception {
        Config config = Config.parse(new String[]{"--reportsDir", dir.toString(), "--reportQuotaCount", "1"});
        ProxyClientStreamTest.RecordingGateway limited = new ProxyClientStreamTest.RecordingGateway() {
            @Override
            public Config getConfig() {
                return config;
            }
        };
        WebSocket page = conn();
        first = new ProxyClient(config, limited);
        Field key = ProxyClient.class.getDeclaredField("accountKey");
        key.setAccessible(true);
        key.set(first, ProxyClient.sessionKey("127.0.0.1", 17171, "alice"));
        first.attach(page, "1", null, -1);
        assertTrue(report(limited, first, page, "r1"), "the first report of the account is stored");

        second = new ProxyClient(config, limited);
        key.set(second, ProxyClient.sessionKey("127.0.0.1", 17171, "alice"));
        second.attach(page, "2", null, -1);
        assertFalse(report(limited, second, page, "r2"), "the quota of the account was used up by its first client");
    }
}
