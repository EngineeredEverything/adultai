#!/bin/bash
# GPU API watchdog - restarts if the API is unresponsive
# Uses /health endpoint (lightweight, won't block during generation)
# Requires 2 consecutive failures before restarting to avoid false positives
export PATH=$PATH:/opt/nvm/versions/node/v22.14.0/bin

FAIL_FILE="/tmp/api_watchdog_fail"
RESPONSE=$(curl -s --max-time 30 -o /dev/null -w "%{http_code}" http://localhost:8080/api/v1/health 2>/dev/null)

if [ "$RESPONSE" = "200" ]; then
    rm -f "$FAIL_FILE"
    echo "$(date) - API OK" >> /root/urpm/logs/watchdog.log
else
    if [ -f "$FAIL_FILE" ]; then
        # Second consecutive failure - restart
        echo "$(date) - API unresponsive 2x in a row (HTTP $RESPONSE), restarting..." >> /root/urpm/logs/watchdog.log
        rm -f "$FAIL_FILE"
        pkill -9 -f "python3.*main.py" 2>/dev/null
        sleep 5
        cd /root/urpm && PORT=8080 nohup python3 main.py >> /root/urpm/logs/api.log 2>&1 &
        echo "$(date) - API restarted (PID $!)" >> /root/urpm/logs/watchdog.log
    else
        # First failure - mark it, wait for next cycle
        touch "$FAIL_FILE"
        echo "$(date) - API check failed (HTTP $RESPONSE), will retry next cycle" >> /root/urpm/logs/watchdog.log
    fi
fi
