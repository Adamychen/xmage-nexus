
package mage.remote.interfaces;

import mage.cards.decks.DeckCardLists;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * @author noxx
 */
public interface Testable {

    boolean isTestMode();

    boolean cheatShow(UUID gameId, UUID playerId);

    /**
     * Nexus P1: coloca cartas por nombre en las zonas del jugador (solo testMode,
     * el servidor rechaza fuera de testMode). Zonas: hand, battlefield, library,
     * graveyard, exile. Falla suave (false) si el servidor no lo soporta.
     */
    boolean cheatSetup(UUID gameId, UUID playerId, Map<String, List<String>> cardsByZone);
}
