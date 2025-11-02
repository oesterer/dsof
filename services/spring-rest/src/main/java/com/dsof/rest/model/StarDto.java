package com.dsof.rest.model;

public record StarDto(
        int hrNumber,
        String name,
        double raHours,
        double decDeg,
        Double magnitude,
        String flamsteedDesignation,
        String bayerDesignation,
        String constellationAbbreviation
) {
}
