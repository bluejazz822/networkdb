#!/bin/bash

# Network CMDB Database Backup Script
# This script creates a backup of the MySQL database used by the Network CMDB

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups/database}"
DB_HOST="${DB_HOST:-172.16.30.62}"
DB_PORT="${DB_PORT:-44060}"
DB_NAME="${DB_NAME:-mydatabase}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if required variables are set
check_requirements() {
    log "Checking requirements..."

    if [ -z "$DB_PASSWORD" ]; then
        error "DB_PASSWORD environment variable is required"
        exit 1
    fi

    if ! command -v mysqldump &> /dev/null; then
        error "mysqldump is not installed"
        exit 1
    fi

    success "Requirements check passed"
}

# Create backup directory
create_backup_dir() {
    log "Creating backup directory..."
    mkdir -p "$BACKUP_DIR"
    chmod 750 "$BACKUP_DIR"
    success "Backup directory created: $BACKUP_DIR"
}

# Test database connection
test_connection() {
    log "Testing database connection..."

    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "SELECT 1;" "$DB_NAME" >/dev/null 2>&1; then
        success "Database connection successful"
    else
        error "Failed to connect to database"
        exit 1
    fi
}

# Create database backup
create_backup() {
    local timestamp=$(date +'%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_DIR/networkdb_backup_${timestamp}.sql"
    local backup_file_gz="${backup_file}.gz"

    log "Creating database backup..."
    log "Backup file: $backup_file_gz"

    # Create backup with mysqldump
    mysqldump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --user="$DB_USER" \
        --password="$DB_PASSWORD" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --create-options \
        --extended-insert \
        --quick \
        --lock-tables=false \
        "$DB_NAME" | gzip > "$backup_file_gz"

    if [ $? -eq 0 ]; then
        local file_size=$(du -h "$backup_file_gz" | cut -f1)
        success "Database backup created successfully: $backup_file_gz ($file_size)"

        # Create a latest symlink
        cd "$BACKUP_DIR"
        ln -sf "$(basename "$backup_file_gz")" "networkdb_backup_latest.sql.gz"
        success "Latest backup symlink updated"
    else
        error "Failed to create database backup"
        exit 1
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than $RETAIN_DAYS days)..."

    local deleted_count=0

    # Find and delete old backups
    if [ -d "$BACKUP_DIR" ]; then
        while IFS= read -r -d '' file; do
            log "Deleting old backup: $(basename "$file")"
            rm -f "$file"
            ((deleted_count++))
        done < <(find "$BACKUP_DIR" -name "networkdb_backup_*.sql.gz" -type f -mtime +$RETAIN_DAYS -print0)
    fi

    if [ $deleted_count -gt 0 ]; then
        success "Deleted $deleted_count old backup(s)"
    else
        log "No old backups to delete"
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$BACKUP_DIR/networkdb_backup_latest.sql.gz"

    if [ -f "$backup_file" ]; then
        log "Verifying backup integrity..."

        # Check if gzip file is valid
        if gzip -t "$backup_file" 2>/dev/null; then
            success "Backup file integrity verified"
        else
            error "Backup file is corrupted"
            exit 1
        fi
    else
        error "Backup file not found: $backup_file"
        exit 1
    fi
}

# Generate backup report
generate_report() {
    local backup_file="$BACKUP_DIR/networkdb_backup_latest.sql.gz"
    local report_file="$BACKUP_DIR/backup_report.txt"

    log "Generating backup report..."

    cat > "$report_file" << EOF
Network CMDB Database Backup Report
===================================

Backup Date: $(date)
Database Host: $DB_HOST:$DB_PORT
Database Name: $DB_NAME
Backup File: $backup_file
File Size: $(du -h "$backup_file" 2>/dev/null | cut -f1 || echo "Unknown")

Backup Status: SUCCESS

Available Backups:
$(ls -lh "$BACKUP_DIR"/networkdb_backup_*.sql.gz 2>/dev/null | awk '{print $9, $5, $6, $7, $8}' || echo "None")

EOF

    success "Backup report generated: $report_file"
}

# Main execution
main() {
    log "Starting Network CMDB database backup..."

    check_requirements
    create_backup_dir
    test_connection
    create_backup
    verify_backup
    cleanup_old_backups
    generate_report

    success "Database backup completed successfully!"
}

# Help function
show_help() {
    cat << EOF
Network CMDB Database Backup Script

Usage: $0 [OPTIONS]

Environment Variables:
  BACKUP_DIR    Directory to store backups (default: ./backups/database)
  DB_HOST       Database host (default: 172.16.30.62)
  DB_PORT       Database port (default: 44060)
  DB_NAME       Database name (default: mydatabase)
  DB_USER       Database user (default: root)
  DB_PASSWORD   Database password (required)
  RETAIN_DAYS   Days to retain backups (default: 7)

Options:
  -h, --help    Show this help message

Examples:
  # Basic backup
  DB_PASSWORD=yourpassword ./backup-database.sh

  # Custom backup directory and retention
  DB_PASSWORD=yourpassword BACKUP_DIR=/opt/backups RETAIN_DAYS=14 ./backup-database.sh

EOF
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac