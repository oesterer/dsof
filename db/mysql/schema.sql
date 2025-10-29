-- Schema definition for MySQL

DROP TABLE IF EXISTS planet_orbital_elements;
DROP TABLE IF EXISTS planets;
DROP TABLE IF EXISTS constellation_line_points;
DROP TABLE IF EXISTS stars;
DROP TABLE IF EXISTS messier_objects;
DROP TABLE IF EXISTS constellations;

CREATE TABLE constellations (
  abbreviation VARCHAR(3) NOT NULL,
  name VARCHAR(64) NOT NULL,
  rank TINYINT,
  label_ra_hours DECIMAL(9,6),
  label_dec_deg DECIMAL(9,6),
  PRIMARY KEY (abbreviation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE constellation_line_points (
  constellation_abbreviation VARCHAR(3) NOT NULL,
  line_index SMALLINT NOT NULL,
  point_index SMALLINT NOT NULL,
  ra_hours DECIMAL(9,6) NOT NULL,
  dec_deg DECIMAL(9,6) NOT NULL,
  PRIMARY KEY (constellation_abbreviation, line_index, point_index),
  CONSTRAINT fk_line_constellation FOREIGN KEY (constellation_abbreviation)
    REFERENCES constellations(abbreviation)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE stars (
  hr_number INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  ra_hours DECIMAL(9,6) NOT NULL,
  dec_deg DECIMAL(9,6) NOT NULL,
  magnitude DECIMAL(5,2),
  flamsteed_designation VARCHAR(16),
  bayer_designation VARCHAR(16),
  constellation_abbreviation VARCHAR(3),
  PRIMARY KEY (hr_number),
  CONSTRAINT fk_star_constellation FOREIGN KEY (constellation_abbreviation)
    REFERENCES constellations(abbreviation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE messier_objects (
  designation VARCHAR(8) NOT NULL,
  name VARCHAR(128),
  object_type VARCHAR(32) NOT NULL,
  ra_hours DECIMAL(9,6) NOT NULL,
  dec_deg DECIMAL(9,6) NOT NULL,
  constellation_abbreviation VARCHAR(3),
  PRIMARY KEY (designation),
  CONSTRAINT fk_messier_constellation FOREIGN KEY (constellation_abbreviation)
    REFERENCES constellations(abbreviation)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE planets (
  name VARCHAR(32) NOT NULL,
  display_name VARCHAR(64) NOT NULL,
  color_hex CHAR(7),
  size SMALLINT,
  icon VARCHAR(16),
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE planet_orbital_elements (
  planet_name VARCHAR(32) NOT NULL,
  semi_major_axis_au DECIMAL(12,8),
  eccentricity DECIMAL(10,8),
  inclination_deg DECIMAL(8,4),
  longitude_ascending_node_deg DECIMAL(9,4),
  longitude_perihelion_deg DECIMAL(9,4),
  mean_longitude_deg DECIMAL(9,4),
  mean_motion_deg_per_day DECIMAL(10,6),
  PRIMARY KEY (planet_name),
  CONSTRAINT fk_orbit_planet FOREIGN KEY (planet_name)
    REFERENCES planets(name)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
