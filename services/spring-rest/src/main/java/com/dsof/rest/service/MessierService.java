package com.dsof.rest.service;

import com.dsof.rest.model.MessierObjectDto;
import com.dsof.rest.repository.MessierRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MessierService {

    private final MessierRepository messierRepository;

    public MessierService(MessierRepository messierRepository) {
        this.messierRepository = messierRepository;
    }

    public List<MessierObjectDto> findMessierObjects(String objectType, String constellation) {
        return messierRepository.findMessierObjects(objectType, constellation);
    }

    public Optional<MessierObjectDto> findByDesignation(String designation) {
        return Optional.ofNullable(messierRepository.findByDesignation(designation));
    }
}
