package com.ecommerce.product.dto;

import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateProductRequest {

    @NotBlank(message = "Product name is required")
    @Size(max = 200, message = "Name must be less than 200 characters")
    private String name;

    private String description;

    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.01", message = "Price must be greater than 0")
    private BigDecimal price;

    private BigDecimal compareAtPrice;

    private BigDecimal costPrice;

    private UUID categoryId;

    @Size(max = 100, message = "Brand must be less than 100 characters")
    private String brand;

    @Size(max = 50, message = "SKU must be less than 50 characters")
    private String sku;

    private String barcode;

    private Boolean isFeatured;

    private BigDecimal weight;

    private String weightUnit;

    private List<CreateProductImageRequest> images;

    private List<CreateProductVariantRequest> variants;

    private List<String> tags;

    @Size(max = 200, message = "Meta title must be less than 200 characters")
    private String metaTitle;

    @Size(max = 500, message = "Meta description must be less than 500 characters")
    private String metaDescription;
}
