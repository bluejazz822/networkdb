#!/bin/bash

# Security wrapper for script execution
# This script provides additional security checks and resource monitoring

set -euo pipefail

# Configuration from environment variables
MAX_EXECUTION_TIME=${SCRIPT_TIMEOUT:-1800}  # 30 minutes default
MAX_MEMORY=${SCRIPT_MEMORY:-512}            # 512MB default
MAX_CPU=${SCRIPT_CPU:-1}                    # 1 CPU default
SCRIPT_FILE=${SCRIPT_FILE:-""}
SCRIPT_ARGS=${SCRIPT_ARGS:-""}
LOG_FILE=${LOG_FILE:-"/app/logs/execution.log"}

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Cleanup function
cleanup() {
    log "Cleaning up execution environment..."
    # Kill any remaining child processes
    jobs -p | xargs -r kill -TERM 2>/dev/null || true
    # Remove temporary files
    find /app/workspace -name "*.tmp" -type f -delete 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT

# Validate inputs
if [[ -z "$SCRIPT_FILE" ]]; then
    error_exit "SCRIPT_FILE environment variable not set"
fi

if [[ ! -f "$SCRIPT_FILE" ]]; then
    error_exit "Script file does not exist: $SCRIPT_FILE"
fi

# Check script permissions
if [[ ! -r "$SCRIPT_FILE" ]]; then
    error_exit "Script file is not readable: $SCRIPT_FILE"
fi

# Detect script language
SCRIPT_EXT="${SCRIPT_FILE##*.}"
case "$SCRIPT_EXT" in
    py|python)
        INTERPRETER="python3"
        ;;
    sh|bash)
        INTERPRETER="bash"
        ;;
    js)
        INTERPRETER="node"
        ;;
    *)
        error_exit "Unsupported script type: $SCRIPT_EXT"
        ;;
esac

log "Starting script execution: $SCRIPT_FILE"
log "Interpreter: $INTERPRETER"
log "Max execution time: ${MAX_EXECUTION_TIME}s"
log "Max memory: ${MAX_MEMORY}MB"
log "Max CPU: $MAX_CPU"

# Set resource limits using ulimit
ulimit -t "$MAX_EXECUTION_TIME"      # CPU time
ulimit -v $((MAX_MEMORY * 1024))     # Virtual memory in KB
ulimit -f 1048576                    # File size limit (1GB)
ulimit -n 1024                       # Max open files
ulimit -u 100                        # Max processes

# Change to workspace directory
cd /app/workspace

# Set restricted PATH
export PATH="/usr/local/bin:/usr/bin:/bin"

# Set environment variables for script
export SCRIPT_START_TIME=$(date +%s)
export SCRIPT_WORKSPACE="/app/workspace"
export SCRIPT_OUTPUT_DIR="/app/output"
export SCRIPT_LOG_DIR="/app/logs"

# Create output directory if it doesn't exist
mkdir -p "$SCRIPT_OUTPUT_DIR"

# Start resource monitoring in background
monitor_resources() {
    local pid=$1
    local max_memory_kb=$((MAX_MEMORY * 1024))
    
    while kill -0 "$pid" 2>/dev/null; do
        # Get process stats
        if [[ -f "/proc/$pid/stat" ]]; then
            local stats=($(cat /proc/$pid/stat))
            local cpu_time=${stats[13]}
            local memory_kb=$(awk '/VmRSS/ {print $2}' "/proc/$pid/status" 2>/dev/null || echo 0)
            
            # Check memory limit
            if (( memory_kb > max_memory_kb )); then
                log "WARN: Memory limit exceeded: ${memory_kb}KB > ${max_memory_kb}KB"
                kill -TERM "$pid"
                sleep 2
                kill -KILL "$pid" 2>/dev/null || true
                break
            fi
            
            # Log resource usage every 30 seconds
            if (( $(date +%s) % 30 == 0 )); then
                log "Resource usage - PID: $pid, Memory: ${memory_kb}KB, CPU Time: ${cpu_time}"
            fi
        fi
        
        sleep 1
    done
}

# Execute script with timeout
log "Executing script with $INTERPRETER..."

# Start script execution
if [[ -n "$SCRIPT_ARGS" ]]; then
    timeout "$MAX_EXECUTION_TIME" "$INTERPRETER" "$SCRIPT_FILE" $SCRIPT_ARGS &
else
    timeout "$MAX_EXECUTION_TIME" "$INTERPRETER" "$SCRIPT_FILE" &
fi

SCRIPT_PID=$!

# Start resource monitoring
monitor_resources "$SCRIPT_PID" &
MONITOR_PID=$!

# Wait for script to complete
wait "$SCRIPT_PID"
SCRIPT_EXIT_CODE=$?

# Stop resource monitoring
kill "$MONITOR_PID" 2>/dev/null || true

# Log completion
SCRIPT_END_TIME=$(date +%s)
EXECUTION_TIME=$((SCRIPT_END_TIME - SCRIPT_START_TIME))

log "Script execution completed"
log "Exit code: $SCRIPT_EXIT_CODE"
log "Execution time: ${EXECUTION_TIME}s"

# Collect output files
OUTPUT_FILES=$(find "$SCRIPT_OUTPUT_DIR" -type f 2>/dev/null | wc -l)
log "Output files generated: $OUTPUT_FILES"

# Exit with script's exit code
exit "$SCRIPT_EXIT_CODE"