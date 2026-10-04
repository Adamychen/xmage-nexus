package org.mage.rl;

import mage.abilities.ActivatedAbility;
import mage.abilities.Ability;
import mage.constants.RangeOfInfluence;
import mage.game.Game;
import mage.game.permanent.Permanent;
import mage.player.ai.ComputerPlayer;

import java.util.List;
import java.util.UUID;

/**
 * RL-driven player: the three big decisions (priority, attackers, blockers)
 * go to Python over the runner's pipe; every other prompt falls back to the
 * ComputerPlayer defaults (auto mana, AI targeting, mulligan keep).
 */
public class RlPlayer extends ComputerPlayer {

    public final String seat;
    private final RlRunner runner;

    public RlPlayer(String name, String seat, RlRunner runner) {
        super(name, RangeOfInfluence.ONE);
        this.seat = seat;
        this.runner = runner;
    }

    @Override
    public boolean priority(Game game) {
        String line = runner.ask(seat, game, "priority");
        Integer play = RlRunner.playIndex(line);
        if (play != null && play >= 0) {
            List<ActivatedAbility> playable = runner.lastPlayableOf(seat);
            if (play < playable.size()) {
                ActivatedAbility ability = playable.get(play);
                if (activateAbility(ability.copy(), game)) {
                    return true;
                }
            }
        }
        pass(game);
        return false;
    }

    @Override
    public void selectAttackers(Game game, UUID attackingPlayerId) {
        String line = runner.ask(seat, game, "attackers");
        List<Permanent> cands = runner.lastCandsOf(seat);
        for (Integer idx : RlRunner.intList(line, "attackers")) {
            if (idx >= 0 && idx < cands.size()) {
                Permanent attacker = cands.get(idx);
                UUID defenderId = runner.opponentIdOf(seat);
                if (attacker.canAttack(defenderId, game)) {
                    declareAttacker(attacker.getId(), defenderId, game, false);
                }
            }
        }
    }

    @Override
    public void selectBlockers(Ability source, Game game, UUID defendingPlayerId) {
        String line = runner.ask(seat, game, "blockers");
        List<Permanent> cands = runner.lastCandsOf(seat);
        List<UUID> attackers = runner.lastAttackersOf(seat);
        for (int[] pair : RlRunner.pairs(line)) {
            if (pair[0] >= 0 && pair[0] < cands.size() && pair[1] >= 0 && pair[1] < attackers.size()) {
                Permanent blocker = cands.get(pair[0]);
                UUID attackerId = attackers.get(pair[1]);
                if (blocker.canBlock(attackerId, game)) {
                    declareBlocker(defendingPlayerId, blocker.getId(), attackerId, game, false);
                }
            }
        }
    }
}
