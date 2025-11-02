-- Schema definition for DuckDB

DROP TABLE IF EXISTS planet_orbital_elements;
DROP TABLE IF EXISTS planets;
DROP TABLE IF EXISTS constellation_line_points;
DROP TABLE IF EXISTS stars;
DROP TABLE IF EXISTS messier_objects;
DROP TABLE IF EXISTS constellations;

CREATE TABLE constellations (
  abbreviation VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  rank_order SMALLINT,
  label_ra_hours DECIMAL(9,6),
  label_dec_deg DECIMAL(9,6),
  PRIMARY KEY (abbreviation)
);

CREATE TABLE constellation_line_points (
  constellation_abbreviation VARCHAR NOT NULL,
  line_index INTEGER NOT NULL,
  point_index INTEGER NOT NULL,
  ra_hours DECIMAL(9,6) NOT NULL,
  dec_deg DECIMAL(9,6) NOT NULL,
  PRIMARY KEY (constellation_abbreviation, line_index, point_index),
  FOREIGN KEY (constellation_abbreviation) REFERENCES constellations(abbreviation) ON DELETE CASCADE
);

CREATE TABLE stars (
  hr_number INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  ra_hours DECIMAL(9,6) NOT NULL,
  dec_deg DECIMAL(9,6) NOT NULL,
  magnitude DECIMAL(5,2),
  flamsteed_designation VARCHAR,
  bayer_designation VARCHAR,
  constellation_abbreviation VARCHAR,
  PRIMARY KEY (hr_number),
  FOREIGN KEY (constellation_abbreviation) REFERENCES constellations(abbreviation)
);

CREATE TABLE messier_objects (
  designation VARCHAR NOT NULL,
  name VARCHAR,
  object_type VARCHAR NOT NULL,
  ra_hours DECIMAL(9,6) NOT NULL,
  dec_deg DECIMAL(9,6) NOT NULL,
  constellation_abbreviation VARCHAR,
  PRIMARY KEY (designation),
  FOREIGN KEY (constellation_abbreviation) REFERENCES constellations(abbreviation)
);

CREATE TABLE planets (
  name VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  color_hex VARCHAR,
  size SMALLINT,
  icon VARCHAR,
  PRIMARY KEY (name)
);

CREATE TABLE planet_orbital_elements (
  planet_name VARCHAR NOT NULL,
  semi_major_axis_au DECIMAL(12,8),
  eccentricity DECIMAL(10,8),
  inclination_deg DECIMAL(8,4),
  longitude_ascending_node_deg DECIMAL(9,4),
  longitude_perihelion_deg DECIMAL(9,4),
  mean_longitude_deg DECIMAL(9,4),
  mean_motion_deg_per_day DECIMAL(10,6),
  PRIMARY KEY (planet_name),
  FOREIGN KEY (planet_name) REFERENCES planets(name) ON DELETE CASCADE
);
