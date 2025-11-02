package com.dsof.rest.repository;

import com.dsof.rest.model.PlanetDto;
import com.dsof.rest.model.PlanetOrbitalElementsDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Repository
public class PlanetRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<PlanetDto> PLANET_ROW_MAPPER = (rs, rowNum) -> new PlanetDto(
            rs.getString("name"),
            rs.getString("display_name"),
            rs.getString("color_hex"),
            getNullableInt(rs, "size"),
            rs.getString("icon")
    );

    private static final RowMapper<PlanetOrbitalElementsDto> ORBITAL_ROW_MAPPER = (rs, rowNum) -> new PlanetOrbitalElementsDto(
            rs.getString("planet_name"),
            getNullableDouble(rs, "semi_major_axis_au"),
            getNullableDouble(rs, "eccentricity"),
            getNullableDouble(rs, "inclination_deg"),
            getNullableDouble(rs, "longitude_ascending_node_deg"),
            getNullableDouble(rs, "longitude_perihelion_deg"),
            getNullableDouble(rs, "mean_longitude_deg"),
            getNullableDouble(rs, "mean_motion_deg_per_day")
    );

    public PlanetRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<PlanetDto> findAll() {
        return jdbcTemplate.query("SELECT name, display_name, color_hex, size, icon FROM planets ORDER BY name", PLANET_ROW_MAPPER);
    }

    public PlanetDto findByName(String name) {
        List<PlanetDto> results = jdbcTemplate.query(
                "SELECT name, display_name, color_hex, size, icon FROM planets WHERE name = ?",
                PLANET_ROW_MAPPER,
                name
        );
        return results.isEmpty() ? null : results.get(0);
    }

    public PlanetOrbitalElementsDto findOrbitalElements(String name) {
        List<PlanetOrbitalElementsDto> results = jdbcTemplate.query(
                "SELECT planet_name, semi_major_axis_au, eccentricity, inclination_deg, longitude_ascending_node_deg, longitude_perihelion_deg, mean_longitude_deg, mean_motion_deg_per_day FROM planet_orbital_elements WHERE planet_name = ?",
                ORBITAL_ROW_MAPPER,
                name
        );
        return results.isEmpty() ? null : results.get(0);
    }

    private static Integer getNullableInt(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    private static Double getNullableDouble(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }
}
