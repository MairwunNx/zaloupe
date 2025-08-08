FROM docker.elastic.co/elasticsearch/elasticsearch:9.1.1
RUN bin/elasticsearch-plugin install --batch analysis-icu
