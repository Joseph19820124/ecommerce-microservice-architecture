package com.ecommerce.product.dto;

import com.ecommerce.product.entity.ProductStatus;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductDTO {
    private UUID id;
    private String name;
    private String description;
    private String slug;
    private BigDecimal price;
    private BigDecimal compareAtPrice;
    private UUID categoryId;
    private String categoryName;
    private String brand;
    private String sku;
    private ProductStatus status;
    private Boolean isActive;
    private Boolean isFeatured;
    private BigDecimal weight;
    private String weightUnit;
    private List<ProductImageDTO> images;
    private List<ProductVariantDTO> variants;
    private List<String> tags;
    private String metaTitle;
    private String metaDescription;
    private Long viewCount;
    private Long soldCount;
    private BigDecimal averageRating;
    private Integer reviewCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
