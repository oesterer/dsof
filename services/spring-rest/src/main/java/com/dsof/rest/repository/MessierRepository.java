package com.dsof.rest.repository;

import com.dsof.rest.model.MessierObjectDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

@Repository
public class MessierRepository {

    private final JdbcTemplate jdbcTemplate;

    private static final RowMapper<MessierObjectDto> MESSIER_ROW_MAPPER = (rs, rowNum) -> new MessierObjectDto(
            rs.getString("designation"),
            rs.getString("name"),
            rs.getString("object_type"),
            rs.getDouble("ra_hours"),
            rs.getDouble("dec_deg"),
            rs.getString("constellation_abbreviation")
    );

    public MessierRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<MessierObjectDto> findMessierObjects(String objectType, String constellation) {
        StringBuilder sql = new StringBuilder("SELECT designation, name, object_type, ra_hours, dec_deg, constellation_abbreviation FROM messier_objects");
        List<String> conditions = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (objectType != null && !objectType.isBlank()) {
            conditions.add("object_type = ?");
            params.add(objectType);
        }
        if (constellation != null && !constellation.isBlank()) {
            conditions.add("constellation_abbreviation = ?");
            params.add(constellation);
        }
        if (!conditions.isEmpty()) {
            sql.append(" WHERE ").append(String.join(" AND ", conditions));
        }
        sql.append(" ORDER BY designation");

        return jdbcTemplate.query(sql.toString(), MESSIER_ROW_MAPPER, params.toArray());
    }

    public MessierObjectDto findByDesignation(String designation) {
        List<MessierObjectDto> results = jdbcTemplate.query(
                "SELECT designation, name, object_type, ra_hours, dec_deg, constellation_abbreviation FROM messier_objects WHERE designation = ?",
                MESSIER_ROW_MAPPER,
                designation
        );
        return results.isEmpty() ? null : results.get(0);
    }
}
