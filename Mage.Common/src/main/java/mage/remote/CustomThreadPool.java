package mage.remote;

import java.lang.reflect.Field;
import java.util.concurrent.ThreadPoolExecutor;

import org.apache.log4j.Logger;
import org.jboss.util.threadpool.BasicThreadPool;
import org.jboss.util.threadpool.BlockingMode;
import org.jboss.util.threadpool.Task;
import org.jboss.util.threadpool.TaskWrapper;

/**
 * The oneway callback pool of a remoting connection - <b>NEXUS PATCH</b> (one file, one change).
 *
 * <p>jboss-remoting instantiates this class from the {@code onewayThreadPool} locator parameter,
 * once per connection, and never stops it: {@code Client.disconnect()},
 * {@code ServerInvoker.stop()} and {@code ServerInvoker.destroy()} do not touch the pool (checked
 * against the 2.5.4.SP5 bytecode). The desktop client logs in once per app run and leaks four
 * parked threads; the proxy creates one connection per browser session plus one per SIM seat, so it
 * leaked four threads per session for the life of the process - a single four-player game left 12
 * pools and 48 threads, and ~100 sessions reached 105 pools and 420 parked threads - until the whole
 * proxy slowed down and games stopped producing views.
 *
 * <p>Every instance therefore delegates to one shared pool: the threads are bounded by that pool's
 * size instead of growing with the number of sessions, and a session going away cannot stop the
 * pool the other sessions are using. {@code ServerInvoker} only ever calls {@link #run(Runnable)}
 * and the three setters, so nothing else needs delegating, and the per-instance executor stays
 * empty (its threads are created lazily, on the first task) - which is what makes the instances
 * harmless.
 *
 * <p>Upstream merge note: everything here is additive. If upstream fixes the leak on its own, this
 * class can be dropped and the change reverted in one step; nothing else in the fork depends on it.
 * See {@code docs/lessons.md} and the {@code mage-fork-upgrade} skill.
 */
public class CustomThreadPool extends BasicThreadPool {

    private static final Logger logger = Logger.getLogger(CustomThreadPool.class);

    /** One dispatch pool for the whole JVM, sized through {@link #setMaximumPoolSize(int)}. */
    private static final BasicThreadPool SHARED = new BasicThreadPool("JBossRemoting Oneway (shared)");

    public CustomThreadPool() {
        super();
    }

    public CustomThreadPool(String name) {
        super(name);
    }

    public CustomThreadPool(String name, ThreadGroup group) {
        super(name, group);
    }

    /**
     * Where the work actually goes. {@code BasicThreadPool} sizes its executor with
     * {@code core == max == 4} and keeping this pool per instance is what leaked the threads.
     */
    @Override
    public void run(Runnable runnable) {
        if (runnable != null) {
            SHARED.run(runnable);
        }
    }

    @Override
    public void run(Runnable runnable, long startTime, long period) {
        if (runnable != null) {
            SHARED.run(runnable, startTime, period);
        }
    }

    @Override
    public void runTask(Task task) {
        if (task != null) {
            SHARED.runTask(task);
        }
    }

    @Override
    public void runTaskWrapper(TaskWrapper wrapper) {
        if (wrapper != null) {
            SHARED.runTaskWrapper(wrapper);
        }
    }

    /**
     * Applied to the shared pool, and in the order {@code BasicThreadPool} gets wrong: it sets the
     * core size before the maximum, so its own {@code setMaximumPoolSize} throws
     * {@link IllegalArgumentException} whenever the requested size is above the executor's current
     * maximum - which is what silently orphaned the pool the client was supposed to keep.
     */
    @Override
    public void setMaximumPoolSize(int size) {
        resize(SHARED, size);
    }

    @Override
    public void setMinimumPoolSize(int size) {
        resize(SHARED, size);
    }

    @Override
    public void setMaximumQueueSize(int size) {
        SHARED.setMaximumQueueSize(size);
    }

    @Override
    public void setBlockingMode(BlockingMode mode) {
        SHARED.setBlockingMode(mode);
    }

    /** Shared on purpose: one session closing must not stop the callbacks of all the others. */
    @Override
    public void stop() {
    }

    @Override
    public void stop(boolean immediate) {
    }

    private static void resize(BasicThreadPool pool, int size) {
        if (size <= 0) {
            return;
        }
        try {
            Field executorField = BasicThreadPool.class.getField("executor");
            executorField.setAccessible(true);
            ThreadPoolExecutor executor = (ThreadPoolExecutor) executorField.get(pool);
            synchronized (executor) {
                executor.setMaximumPoolSize(size);
                executor.setCorePoolSize(size);
            }
        } catch (NoSuchFieldException | SecurityException | IllegalArgumentException | IllegalAccessException e) {
            logger.error("Failed to resize the shared oneway thread pool", e);
        }
    }
}
