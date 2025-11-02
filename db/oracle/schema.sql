-- Schema definition for Oracle Database

BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE planet_orbital_elements CASCADE CONSTRAINTS';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE planets CASCADE CONSTRAINTS';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE constellation_line_points CASCADE CONSTRAINTS';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE stars CASCADE CONSTRAINTS';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE messier_objects CASCADE CONSTRAINTS';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN RAISE; END IF;
END;
/
BEGIN
  EXECUTE IMMEDIATE 'DROP TABLE constellations CASCADE CONSTRAINTS';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

CREATE TABLE constellations (
  abbreviation VARCHAR2(3) PRIMARY KEY,
  name VARCHAR2(64) NOT NULL,
  rank_order NUMBER(3),
  label_ra_hours NUMBER(9,6),
  label_dec_deg NUMBER(9,6)
);

CREATE TABLE constellation_line_points (
  constellation_abbreviation VARCHAR2(3) NOT NULL,
  line_index NUMBER(6) NOT NULL,
  point_index NUMBER(6) NOT NULL,
  ra_hours NUMBER(9,6) NOT NULL,
  dec_deg NUMBER(9,6) NOT NULL,
  CONSTRAINT pk_constellation_line_points PRIMARY KEY (constellation_abbreviation, line_index, point_index),
  CONSTRAINT fk_line_constellation FOREIGN KEY (constellation_abbreviation)
    REFERENCES constellations(abbreviation) ON DELETE CASCADE
);

CREATE TABLE stars (
  hr_number NUMBER(10) PRIMARY KEY,
  name VARCHAR2(128) NOT NULL,
  ra_hours NUMBER(9,6) NOT NULL,
  dec_deg NUMBER(9,6) NOT NULL,
  magnitude NUMBER(5,2),
  flamsteed_designation VARCHAR2(16),
  bayer_designation VARCHAR2(16),
  constellation_abbreviation VARCHAR2(3),
  CONSTRAINT fk_star_constellation FOREIGN KEY (constellation_abbreviation)
    REFERENCES constellations(abbreviation)
);

CREATE TABLE messier_objects (
  designation VARCHAR2(8) PRIMARY KEY,
  name VARCHAR2(128),
  object_type VARCHAR2(32) NOT NULL,
  ra_hours NUMBER(9,6) NOT NULL,
  dec_deg NUMBER(9,6) NOT NULL,
  constellation_abbreviation VARCHAR2(3),
  CONSTRAINT fk_messier_constellation FOREIGN KEY (constellation_abbreviation)
    REFERENCES constellations(abbreviation)
);

CREATE TABLE planets (
  name VARCHAR2(32) PRIMARY KEY,
  display_name VARCHAR2(64) NOT NULL,
  color_hex CHAR(7),
  size NUMBER(6),
  icon VARCHAR2(16)
);

CREATE TABLE planet_orbital_elements (
  planet_name VARCHAR2(32) PRIMARY KEY,
  semi_major_axis_au NUMBER(12,8),
  eccentricity NUMBER(10,8),
  inclination_deg NUMBER(8,4),
  longitude_ascending_node_deg NUMBER(9,4),
  longitude_perihelion_deg NUMBER(9,4),
  mean_longitude_deg NUMBER(9,4),
  mean_motion_deg_per_day NUMBER(10,6),
  CONSTRAINT fk_orbit_planet FOREIGN KEY (planet_name)
    REFERENCES planets(name) ON DELETE CASCADE
);
