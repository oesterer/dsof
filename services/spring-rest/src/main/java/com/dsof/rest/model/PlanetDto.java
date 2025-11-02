package com.dsof.rest.model;

public record PlanetDto(
        String name,
        String displayName,
        String colorHex,
        Integer size,
        String icon
) {
}
