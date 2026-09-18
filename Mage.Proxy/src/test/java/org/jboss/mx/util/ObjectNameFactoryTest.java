package org.jboss.mx.util;

import javax.management.ObjectName;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ObjectNameFactoryTest {

    @Test
    void createsObjectName() throws Exception {
        ObjectName name = ObjectNameFactory.create("remoting:type=Detector");
        assertEquals("remoting", name.getDomain());
        assertEquals("Detector", name.getKeyProperty("type"));
    }

    @Test
    void rejectsInvalidName() {
        assertThrows(IllegalArgumentException.class, () -> ObjectNameFactory.create("not a valid name"));
    }
}
