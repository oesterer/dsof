package com.dsof.rest.service;

import com.dsof.rest.model.StarDto;
import com.dsof.rest.model.StarQuery;
import com.dsof.rest.repository.StarRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class StarService {

    private final StarRepository starRepository;

    public StarService(StarRepository starRepository) {
        this.starRepository = starRepository;
    }

    public List<StarDto> findStars(StarQuery query) {
        return starRepository.findStars(query);
    }

    public Optional<StarDto> findByHrNumber(int hrNumber) {
        return Optional.ofNullable(starRepository.findByHrNumber(hrNumber));
    }
}
