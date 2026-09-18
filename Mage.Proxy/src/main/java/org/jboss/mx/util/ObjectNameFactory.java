package org.jboss.mx.util;

import javax.management.MalformedObjectNameException;
import javax.management.ObjectName;

/**
 * Shim de la clase de jboss-mx que jboss-remoting usa SOLO en el failover por
 * clustering/JMX de TransporterClient (findAlternativeTarget), alcanzable
 * únicamente tras un CannotConnectException. El artefacto original
 * (org.jboss.mx:jbossmx:4.0.2.GA) ya no se publica en ningún repositorio
 * (JBoss lo purgó y Maven Central nunca lo tuvo) y el proxy no usa clustering:
 * conecta con locator explícito al host/puerto del server. Con esta clase el
 * singleton InternalTransporterServices inicializa, el NetworkRegistry queda
 * nulo y findAlternativeTarget devuelve false, propagando el
 * CannotConnectException original. Sin ella, la primera caída del server deja
 * InternalTransporterServices con el &lt;clinit&gt; fallido para siempre en ese
 * JVM (NoClassDefFoundError en cada llamada del failover) y publishLobby
 * escribe un stack de ~70 KB cada 2 s mientras dure la caída.
 */
public final class ObjectNameFactory {

    private ObjectNameFactory() {
    }

    public static ObjectName create(String name) {
        try {
            return new ObjectName(name);
        } catch (MalformedObjectNameException e) {
            throw new IllegalArgumentException("Invalid ObjectName: " + name, e);
        }
    }
}
