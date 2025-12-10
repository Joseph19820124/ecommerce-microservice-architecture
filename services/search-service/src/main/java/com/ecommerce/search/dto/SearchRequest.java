package com.ecommerce.search.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SearchRequest {
    private String query;
    private String categoryId;
    private String brandId;
    private List<String> tags;
    private BigDecimal minPrice;
    private BigDecimal maxPrice;
    private Float minRating;
    private Boolean inStock;
    private Boolean featured;
    private String sortBy;
    private String sortOrder;
    private Integer page;
    private Integer size;
}
