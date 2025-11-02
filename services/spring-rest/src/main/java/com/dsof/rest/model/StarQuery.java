package com.dsof.rest.model;

public record StarQuery(
        Integer limit,
        Double minMagnitude,
        Double maxMagnitude,
        String constellationAbbreviation
) {
}
