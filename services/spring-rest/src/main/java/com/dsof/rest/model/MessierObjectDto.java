package com.dsof.rest.model;

public record MessierObjectDto(
        String designation,
        String name,
        String objectType,
        double raHours,
        double decDeg,
        String constellationAbbreviation
) {
}
