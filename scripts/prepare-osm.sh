#!/usr/bin/env bash
set -euo pipefail

cache_dir="${1:-.cache/osm}"
mkdir -p "$cache_dir"

source_url="https://download.geofabrik.de/asia/indonesia/java-260825.osm.pbf"
source_pbf="$cache_dir/java-260825.osm.pbf"
extract_pbf="$cache_dir/jakarta.osm.pbf"
filtered_pbf="$cache_dir/jakarta-filtered.osm.pbf"
named_pbf="$cache_dir/jakarta-named.osm.pbf"

if [[ ! -f "$source_pbf" ]]; then
  curl -L --fail --silent --show-error --output "$source_pbf" "$source_url"
fi

expected_sha="d490da915938cdc8df6c0e13e067f63d4df1b58460313694563c4834f51b9dfb"
actual_sha="$(shasum -a 256 "$source_pbf" | awk '{print $1}')"
if [[ "$actual_sha" != "$expected_sha" ]]; then
  echo "Source checksum mismatch: expected $expected_sha, got $actual_sha" >&2
  exit 1
fi

osmium extract \
  --bbox=106.785,-6.235,106.855,-6.155 \
  --strategy=complete_ways \
  --set-bounds \
  --overwrite \
  -o "$extract_pbf" \
  "$source_pbf"

osmium tags-filter \
  --overwrite \
  -o "$filtered_pbf" \
  "$extract_pbf" \
  'w/highway=motorway,trunk,primary,secondary,tertiary,residential' \
  'nwr/natural=water' \
  'nwr/waterway=river,canal,stream' \
  'nwr/leisure=park,garden' \
  'nwr/landuse=recreation_ground,grass' \
  'nwr/tourism=attraction,museum' \
  'nwr/historic' \
  'nwr/amenity=place_of_worship'

osmium tags-filter --overwrite -o "$named_pbf" "$extract_pbf" 'nwr/name'

osmium export --overwrite --add-unique-id=type_id --attributes=type,id \
  -o "$cache_dir/jakarta-raw.geojson" "$filtered_pbf"
osmium export --overwrite --add-unique-id=type_id --attributes=type,id \
  -o "$cache_dir/jakarta-named.geojson" "$named_pbf"

node scripts/normalize-osm.mjs \
  "$cache_dir/jakarta-raw.geojson" \
  "$cache_dir/jakarta-named.geojson" \
  public/data

