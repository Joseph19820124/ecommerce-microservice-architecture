package com.ecommerce.product.service;

import com.ecommerce.product.dto.*;
import com.ecommerce.product.entity.*;
import com.ecommerce.product.event.ProductEventPublisher;
import com.ecommerce.product.exception.ResourceNotFoundException;
import com.ecommerce.product.exception.DuplicateResourceException;
import com.ecommerce.product.repository.CategoryRepository;
import com.ecommerce.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final ProductEventPublisher eventPublisher;

    private static final Pattern NONLATIN = Pattern.compile("[^\\w-]");
    private static final Pattern WHITESPACE = Pattern.compile("[\\s]");

    @Transactional
    public ProductDTO createProduct(CreateProductRequest request) {
        String slug = generateSlug(request.getName());
        if (productRepository.existsBySlug(slug)) {
            throw new DuplicateResourceException("Product with this name already exists");
        }

        if (request.getSku() != null && productRepository.existsBySku(request.getSku())) {
            throw new DuplicateResourceException("Product with this SKU already exists");
        }

        Product product = Product.builder()
                .name(request.getName())
                .description(request.getDescription())
                .slug(slug)
                .price(request.getPrice())
                .compareAtPrice(request.getCompareAtPrice())
                .costPrice(request.getCostPrice())
                .brand(request.getBrand())
                .sku(request.getSku())
                .barcode(request.getBarcode())
                .isFeatured(request.getIsFeatured() != null ? request.getIsFeatured() : false)
                .weight(request.getWeight())
                .weightUnit(request.getWeightUnit() != null ? request.getWeightUnit() : "kg")
                .tags(request.getTags())
                .metaTitle(request.getMetaTitle())
                .metaDescription(request.getMetaDescription())
                .status(ProductStatus.DRAFT)
                .build();

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
            product.setCategory(category);
        }

        if (request.getImages() != null) {
            request.getImages().forEach(imageReq -> {
                ProductImage image = ProductImage.builder()
                        .url(imageReq.getUrl())
                        .altText(imageReq.getAltText())
                        .sortOrder(imageReq.getSortOrder() != null ? imageReq.getSortOrder() : 0)
                        .isPrimary(imageReq.getIsPrimary() != null ? imageReq.getIsPrimary() : false)
                        .build();
                product.addImage(image);
            });
        }

        if (request.getVariants() != null) {
            request.getVariants().forEach(variantReq -> {
                ProductVariant variant = ProductVariant.builder()
                        .sku(variantReq.getSku())
                        .name(variantReq.getName())
                        .price(variantReq.getPrice())
                        .compareAtPrice(variantReq.getCompareAtPrice())
                        .option1Name(variantReq.getOption1Name())
                        .option1Value(variantReq.getOption1Value())
                        .option2Name(variantReq.getOption2Name())
                        .option2Value(variantReq.getOption2Value())
                        .option3Name(variantReq.getOption3Name())
                        .option3Value(variantReq.getOption3Value())
                        .imageUrl(variantReq.getImageUrl())
                        .weight(variantReq.getWeight())
                        .sortOrder(variantReq.getSortOrder() != null ? variantReq.getSortOrder() : 0)
                        .build();
                product.addVariant(variant);
            });
        }

        Product saved = productRepository.save(product);
        log.info("Product created: {}", saved.getId());

        eventPublisher.publishProductCreated(saved);

        return mapToDTO(saved);
    }

    @Cacheable(value = "products", key = "#id")
    @Transactional(readOnly = true)
    public ProductDTO getProductById(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        return mapToDTO(product);
    }

    @Cacheable(value = "products", key = "#slug")
    @Transactional(readOnly = true)
    public ProductDTO getProductBySlug(String slug) {
        Product product = productRepository.findBySlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));
        return mapToDTO(product);
    }

    @Transactional(readOnly = true)
    public Page<ProductDTO> getAllProducts(Pageable pageable) {
        return productRepository.findByIsActiveTrue(pageable)
                .map(this::mapToDTO);
    }

    @Transactional(readOnly = true)
    public Page<ProductDTO> getProductsByCategory(UUID categoryId, Pageable pageable) {
        return productRepository.findByCategoryIdAndIsActiveTrue(categoryId, pageable)
                .map(this::mapToDTO);
    }

    @Transactional(readOnly = true)
    public Page<ProductDTO> searchProducts(String keyword, Pageable pageable) {
        return productRepository.searchByKeyword(keyword, pageable)
                .map(this::mapToDTO);
    }

    @Transactional(readOnly = true)
    public List<ProductDTO> getFeaturedProducts(Pageable pageable) {
        return productRepository.findFeaturedProducts(pageable)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ProductDTO> getNewArrivals(Pageable pageable) {
        return productRepository.findNewArrivals(pageable)
                .stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<String> getAllBrands() {
        return productRepository.findAllBrands();
    }

    @CacheEvict(value = "products", allEntries = true)
    @Transactional
    public ProductDTO updateProduct(UUID id, CreateProductRequest request) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        product.setName(request.getName());
        product.setDescription(request.getDescription());
        product.setPrice(request.getPrice());
        product.setCompareAtPrice(request.getCompareAtPrice());
        product.setCostPrice(request.getCostPrice());
        product.setBrand(request.getBrand());
        product.setBarcode(request.getBarcode());
        product.setWeight(request.getWeight());
        product.setMetaTitle(request.getMetaTitle());
        product.setMetaDescription(request.getMetaDescription());

        if (request.getIsFeatured() != null) {
            product.setIsFeatured(request.getIsFeatured());
        }
        if (request.getWeightUnit() != null) {
            product.setWeightUnit(request.getWeightUnit());
        }
        if (request.getTags() != null) {
            product.setTags(request.getTags());
        }

        if (request.getCategoryId() != null) {
            Category category = categoryRepository.findById(request.getCategoryId())
                    .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
            product.setCategory(category);
        }

        Product saved = productRepository.save(product);
        log.info("Product updated: {}", saved.getId());

        eventPublisher.publishProductUpdated(saved);

        return mapToDTO(saved);
    }

    @CacheEvict(value = "products", allEntries = true)
    @Transactional
    public void deleteProduct(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        productRepository.delete(product);
        log.info("Product deleted: {}", id);

        eventPublisher.publishProductDeleted(id);
    }

    @CacheEvict(value = "products", allEntries = true)
    @Transactional
    public ProductDTO activateProduct(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        product.setIsActive(true);
        product.setStatus(ProductStatus.ACTIVE);

        Product saved = productRepository.save(product);
        log.info("Product activated: {}", id);

        return mapToDTO(saved);
    }

    @CacheEvict(value = "products", allEntries = true)
    @Transactional
    public ProductDTO deactivateProduct(UUID id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Product not found"));

        product.setIsActive(false);
        product.setStatus(ProductStatus.INACTIVE);

        Product saved = productRepository.save(product);
        log.info("Product deactivated: {}", id);

        return mapToDTO(saved);
    }

    @Transactional
    public void incrementViewCount(UUID id) {
        productRepository.findById(id).ifPresent(product -> {
            product.setViewCount(product.getViewCount() + 1);
            productRepository.save(product);
        });
    }

    private String generateSlug(String input) {
        String nowhitespace = WHITESPACE.matcher(input).replaceAll("-");
        String normalized = Normalizer.normalize(nowhitespace, Normalizer.Form.NFD);
        String slug = NONLATIN.matcher(normalized).replaceAll("");
        return slug.toLowerCase(Locale.ENGLISH);
    }

    private ProductDTO mapToDTO(Product product) {
        return ProductDTO.builder()
                .id(product.getId())
                .name(product.getName())
                .description(product.getDescription())
                .slug(product.getSlug())
                .price(product.getPrice())
                .compareAtPrice(product.getCompareAtPrice())
                .categoryId(product.getCategory() != null ? product.getCategory().getId() : null)
                .categoryName(product.getCategory() != null ? product.getCategory().getName() : null)
                .brand(product.getBrand())
                .sku(product.getSku())
                .status(product.getStatus())
                .isActive(product.getIsActive())
                .isFeatured(product.getIsFeatured())
                .weight(product.getWeight())
                .weightUnit(product.getWeightUnit())
                .images(product.getImages().stream()
                        .map(this::mapImageToDTO)
                        .collect(Collectors.toList()))
                .variants(product.getVariants().stream()
                        .map(this::mapVariantToDTO)
                        .collect(Collectors.toList()))
                .tags(product.getTags())
                .metaTitle(product.getMetaTitle())
                .metaDescription(product.getMetaDescription())
                .viewCount(product.getViewCount())
                .soldCount(product.getSoldCount())
                .averageRating(product.getAverageRating())
                .reviewCount(product.getReviewCount())
                .createdAt(product.getCreatedAt())
                .updatedAt(product.getUpdatedAt())
                .build();
    }

    private ProductImageDTO mapImageToDTO(ProductImage image) {
        return ProductImageDTO.builder()
                .id(image.getId())
                .url(image.getUrl())
                .altText(image.getAltText())
                .sortOrder(image.getSortOrder())
                .isPrimary(image.getIsPrimary())
                .build();
    }

    private ProductVariantDTO mapVariantToDTO(ProductVariant variant) {
        return ProductVariantDTO.builder()
                .id(variant.getId())
                .sku(variant.getSku())
                .name(variant.getName())
                .price(variant.getPrice())
                .compareAtPrice(variant.getCompareAtPrice())
                .option1Name(variant.getOption1Name())
                .option1Value(variant.getOption1Value())
                .option2Name(variant.getOption2Name())
                .option2Value(variant.getOption2Value())
                .option3Name(variant.getOption3Name())
                .option3Value(variant.getOption3Value())
                .imageUrl(variant.getImageUrl())
                .weight(variant.getWeight())
                .isActive(variant.getIsActive())
                .sortOrder(variant.getSortOrder())
                .build();
    }
}
