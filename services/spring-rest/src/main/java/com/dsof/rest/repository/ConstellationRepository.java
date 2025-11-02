package com.dsof.rest.repository;

import com.dsof.rest.model.ConstellationDto;
import com.dsof.rest.model.ConstellationLinePointDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Repository
public class ConstellationRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<ConstellationDto> CONSTELLATION_ROW_MAPPER = (rs, rowNum) ->
            new ConstellationDto(
                    rs.getString("abbreviation"),
                    rs.getString("name"),
                    getNullableInt(rs, "rank_order"),
                    getNullableDouble(rs, "label_ra_hours"),
                    getNullableDouble(rs, "label_dec_deg")
            );

    private static final RowMapper<ConstellationLinePointDto> LINE_POINT_ROW_MAPPER = (rs, rowNum) ->
            new ConstellationLinePointDto(
                    rs.getInt("line_index"),
                    rs.getInt("point_index"),
                    rs.getDouble("ra_hours"),
                    rs.getDouble("dec_deg")
            );

    public ConstellationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<ConstellationDto> findConstellations(String abbreviation) {
        if (abbreviation != null && !abbreviation.isBlank()) {
            return jdbcTemplate.query(
                    "SELECT abbreviation, name, rank_order, label_ra_hours, label_dec_deg FROM constellations WHERE abbreviation = ?",
                    CONSTELLATION_ROW_MAPPER,
                    abbreviation
            );
        }
        return jdbcTemplate.query(
                "SELECT abbreviation, name, rank_order, label_ra_hours, label_dec_deg FROM constellations ORDER BY abbreviation",
                CONSTELLATION_ROW_MAPPER
        );
    }

    public List<ConstellationLinePointDto> findLinePoints(String abbreviation) {
        return jdbcTemplate.query(
                "SELECT constellation_abbreviation, line_index, point_index, ra_hours, dec_deg FROM constellation_line_points WHERE constellation_abbreviation = ? ORDER BY line_index, point_index",
                LINE_POINT_ROW_MAPPER,
                abbreviation
        );
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
