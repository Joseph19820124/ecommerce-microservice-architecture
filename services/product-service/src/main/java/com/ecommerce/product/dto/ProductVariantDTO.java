package com.ecommerce.product.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductVariantDTO {
    private UUID id;
    private String sku;
    private String name;
    private BigDecimal price;
    private BigDecimal compareAtPrice;
    private String option1Name;
    private String option1Value;
    private String option2Name;
    private String option2Value;
    private String option3Name;
    private String option3Value;
    private String imageUrl;
    private BigDecimal weight;
    private Boolean isActive;
    private Integer sortOrder;
}
