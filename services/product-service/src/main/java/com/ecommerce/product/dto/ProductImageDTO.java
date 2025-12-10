package com.ecommerce.product.dto;

import lombok.*;

import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductImageDTO {
    private UUID id;
    private String url;
    private String altText;
    private Integer sortOrder;
    private Boolean isPrimary;
}
