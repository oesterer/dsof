package com.dsof.rest.repository;

import com.dsof.rest.model.StarDto;
import com.dsof.rest.model.StarQuery;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

@Repository
public class StarRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<StarDto> STAR_ROW_MAPPER = (rs, rowNum) -> new StarDto(
            rs.getInt("hr_number"),
            rs.getString("name"),
            rs.getDouble("ra_hours"),
            rs.getDouble("dec_deg"),
            getNullableDouble(rs, "magnitude"),
            rs.getString("flamsteed_designation"),
            rs.getString("bayer_designation"),
            rs.getString("constellation_abbreviation")
    );

    public StarRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<StarDto> findStars(StarQuery query) {
        StringBuilder sql = new StringBuilder("SELECT hr_number, name, ra_hours, dec_deg, magnitude, flamsteed_designation, bayer_designation, constellation_abbreviation FROM stars");
        List<Object> params = new ArrayList<>();
        List<String> conditions = new ArrayList<>();

        if (query.constellationAbbreviation() != null && !query.constellationAbbreviation().isBlank()) {
            conditions.add("constellation_abbreviation = ?");
            params.add(query.constellationAbbreviation());
        }
        if (query.minMagnitude() != null) {
            conditions.add("magnitude <= ?");
            params.add(query.minMagnitude());
        }
        if (query.maxMagnitude() != null) {
            conditions.add("magnitude >= ?");
            params.add(query.maxMagnitude());
        }

        if (!conditions.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", conditions));
        }

        sql.append(" ORDER BY magnitude IS NULL, magnitude ASC, hr_number ASC");

        if (query.limit() != null && query.limit() > 0) {
            sql.append(" LIMIT ?");
            params.add(query.limit());
        }

        return jdbcTemplate.query(sql.toString(), STAR_ROW_MAPPER, params.toArray());
    }

    public StarDto findByHrNumber(int hrNumber) {
        List<StarDto> results = jdbcTemplate.query(
                "SELECT hr_number, name, ra_hours, dec_deg, magnitude, flamsteed_designation, bayer_designation, constellation_abbreviation FROM stars WHERE hr_number = ?",
                STAR_ROW_MAPPER,
                hrNumber
        );
        return results.isEmpty() ? null : results.get(0);
    }

    private static Double getNullableDouble(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }
}
