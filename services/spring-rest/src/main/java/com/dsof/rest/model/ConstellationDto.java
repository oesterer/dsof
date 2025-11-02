package com.dsof.rest.model;

public record ConstellationDto(
        String abbreviation,
        String name,
        Integer rankOrder,
        Double labelRaHours,
        Double labelDecDeg
) {
}
