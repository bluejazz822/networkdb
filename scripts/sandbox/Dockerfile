# Python Script Execution Sandbox
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Create non-root user
RUN groupadd -r scriptuser && useradd -r -g scriptuser scriptuser

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Basic utilities (limited set)
    curl \
    wget \
    git \
    # Build essentials for Python packages
    build-essential \
    # Clean up
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install common Python packages for data processing
RUN pip install --no-cache-dir \
    # Data processing
    pandas==2.1.4 \
    numpy==1.25.2 \
    requests==2.31.0 \
    # JSON/CSV processing
    ijson==3.2.3 \
    # Database connectivity
    psycopg2-binary==2.9.9 \
    pymysql==1.1.0 \
    # Network monitoring tools
    ping3==4.0.4 \
    paramiko==3.4.0 \
    netaddr==0.10.1

# Create directories
RUN mkdir -p /app/scripts /app/workspace /app/logs /app/output \
    && chown -R scriptuser:scriptuser /app

# Set working directory
WORKDIR /app/workspace

# Copy security wrapper script
COPY scripts/security-wrapper.sh /usr/local/bin/security-wrapper.sh
RUN chmod +x /usr/local/bin/security-wrapper.sh

# Switch to non-root user
USER scriptuser

# Default command
CMD ["python3"]