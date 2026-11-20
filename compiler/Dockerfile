FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      texlive-latex-base texlive-latex-recommended texlive-latex-extra \
      texlive-fonts-recommended texlive-fonts-extra lmodern \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server.mjs .
RUN useradd -r -u 10001 tex && chown -R tex /app
USER tex
ENV PORT=9000
EXPOSE 9000
HEALTHCHECK CMD node -e "fetch('http://localhost:9000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
