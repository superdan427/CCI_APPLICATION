#!/usr/bin/env python3
"""
COS Supply Chain Data Extractor – Full Pipeline
------------------------------------------------
1. Extract style number from a label photo (Google Vision)
2. Scrape product page (curl_cffi bypasses Akamai)
3. Save clean, timestamped JSON file

Usage:
    python cos_full_pipeline.py /path/to/label.jpg
"""

import os
import sys
import re
import json
import argparse
from datetime import datetime
from urllib.parse import urljoin

# OCR
from google.cloud import vision

# Scraping
from curl_cffi import requests
from bs4 import BeautifulSoup

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
PRE_DATA_DIR = os.path.join(PROJECT_DIR, "data", "pre data")

# ----------------------------------------------------------------------
# 1. OCR: Extract style number from image
# ----------------------------------------------------------------------
def extract_style_number(image_path):
    """Run OCR on image, find product number, and transform to 10-digit style."""
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "google-credentials.json"
    
    client = vision.ImageAnnotatorClient()
    with open(image_path, 'rb') as f:
        content = f.read()
    image = vision.Image(content=content)
    
    response = client.text_detection(image=image)
    if response.error.message:
        raise Exception(f"Vision API error: {response.error.message}")
    
    texts = response.text_annotations
    if not texts:
        print("❌ No text found in the image.")
        return None
    
    full_text = texts[0].description
    print("\n" + "="*60)
    print("STEP 1: Reading label photo")
    print("="*60)
    print("📄 Detected text:\n", full_text)
    
    # Look for P/N followed by digits (which may have spaces)
    pattern = r'P/?N[:\s]*((?:\d\s*){8,10})'
    match = re.search(pattern, full_text, re.IGNORECASE)
    
    if match:
        raw_digits = match.group(1)
        digits = re.sub(r'\s+', '', raw_digits)
        print(f"🔢 Found raw number: {digits}")
    else:
        # Fallback: search lines near "P/N"
        lines = full_text.splitlines()
        digits = None
        for i, line in enumerate(lines):
            if re.search(r'P/?N', line, re.IGNORECASE):
                combined = line + (lines[i+1] if i+1 < len(lines) else "")
                nums = re.findall(r'((?:\d\s*){8,10})', combined)
                if nums:
                    digits = re.sub(r'\s+', '', nums[0])
                    break
        if not digits:
            print("❌ Could not find a product number (P/N) in the text.")
            return None
    
    # Transform 8-digit to 10-digit (first 7 + "00" + last)
    if len(digits) == 10:
        return digits
    elif len(digits) == 8:
        return digits[:7] + "00" + digits[-1]
    else:
        print(f"❌ Unexpected number length: {len(digits)} digits.")
        return None

# ----------------------------------------------------------------------
# 2. Scraper class (geocoding removed)
# ----------------------------------------------------------------------
class COSScraper:
    def __init__(self):
        self.base_url = "https://www.cos.com"
        self.session = requests.Session()
        self.session.headers.update({
            "Accept-Language": "en-GB,en;q=0.9",
            "Referer": self.base_url,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
        })
        self.session.cookies.set("SHIPPING_LOCATION", "GB", domain=".cos.com")
        self.session.cookies.set("cos_selected_country", "GB", domain=".cos.com")

    def _get_soup(self, url):
        print(f"🌐 Fetching {url} ...")
        resp = self.session.get(url, impersonate="chrome", timeout=30)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")

    def search_product(self, style_number):
        search_url = f"{self.base_url}/en-gb/search?q={style_number}&search={style_number}"
        soup = self._get_soup(search_url)

        selectors = [
            f'a[href*="/product/"][href*="{style_number}"]',
            'a[data-testid="product-item-link"]',
            'a.g-product-card__link',
            'a.product-card__link'
        ]
        product_link = None
        for selector in selectors:
            elem = soup.select_one(selector)
            if elem:
                product_link = urljoin(self.base_url, elem.get('href'))
                break

        if not product_link:
            for a in soup.find_all('a', href=True):
                if style_number in a['href'] and '/product/' in a['href']:
                    product_link = urljoin(self.base_url, a['href'])
                    break

        if not product_link:
            raise ValueError(f"❌ Product {style_number} not found in search results.")
        return product_link

    def parse_product_page(self, url):
        soup = self._get_soup(url)

        def safe_get(obj, *keys, default=""):
            current = obj
            for key in keys:
                if isinstance(current, dict):
                    current = current.get(key)
                elif isinstance(current, list) and isinstance(key, int) and 0 <= key < len(current):
                    current = current[key]
                else:
                    return default
                if current is None:
                    return default
            return current if current is not None else default

        # JSON-LD for basic info
        ld_data = {}
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and item.get("@type") == "Product":
                            ld_data = item
                            break
                elif isinstance(data, dict) and data.get("@type") == "Product":
                    ld_data = data
                    break
            except:
                continue

        product_name = safe_get(ld_data, 'name')
        if not product_name:
            h1 = soup.find("h1")
            product_name = h1.get_text(strip=True) if h1 else ""

        price = ""
        offers = ld_data.get("offers")
        if isinstance(offers, dict):
            price = offers.get("price", "")
        elif isinstance(offers, list) and offers:
            price = offers[0].get("price", "") if isinstance(offers[0], dict) else ""
        if not price:
            price = ld_data.get("price", "")

        description = safe_get(ld_data, 'description')
        if not description:
            meta_desc = soup.find("meta", attrs={"name": "description"})
            if meta_desc:
                description = meta_desc.get("content", "")

        # __NEXT_DATA__ for detailed info
        next_script = soup.find("script", id="__NEXT_DATA__")
        next_data = {}
        if next_script and next_script.string:
            try:
                next_data = json.loads(next_script.string)
            except:
                pass

        product_obj = None
        if next_data:
            blocks = safe_get(next_data, 'props', 'pageProps', 'blocks')
            if isinstance(blocks, list):
                for block in blocks:
                    if isinstance(block, dict) and block.get('product'):
                        product_obj = block['product']
                        break

        factory_name = factory_address = factory_country = factory_employees = ""
        composition = []
        care_instructions = []

        # New detail fields
        clothing_style = ""
        fit = ""
        garment_length = ""
        sleeve_length = ""
        collar_style = ""

        if product_obj:
            # Supplier info
            supplier_info_json = product_obj.get('var_supplier_info_desc')
            if supplier_info_json:
                try:
                    suppliers = json.loads(supplier_info_json)
                    if suppliers and isinstance(suppliers, list):
                        supplier = suppliers[0]
                        factory_name = supplier.get('factoryName') or supplier.get('suppliername', '')
                        addr = supplier.get('address', {})
                        address_parts = [
                            addr.get('addressStreetLine1', ''),
                            addr.get('addressStreetLine2', ''),
                            addr.get('postalCode', ''),
                            addr.get('city', '')
                        ]
                        factory_address = ', '.join([p for p in address_parts if p])
                        factory_country = addr.get('countryName', '')
                        factory_employees = supplier.get('noOfWorkers', '')
                except:
                    pass

            # Composition
            comp_json = product_obj.get('var_material_composition_desc')
            if comp_json:
                try:
                    comp_data = json.loads(comp_json)
                    if isinstance(comp_data, list):
                        for item in comp_data:
                            materials = item.get('materials', [])
                            for mat in materials:
                                comp_str = f"{mat.get('material', '')} {mat.get('percentage', '')}%".strip()
                                if comp_str:
                                    composition.append(comp_str)
                except:
                    pass

            # Care instructions
            care = product_obj.get('var_care_instruction')
            if isinstance(care, list):
                care_instructions = care

            # --- Product details ---
            clothing_style = product_obj.get('pr_product_type_name', '')
            fit = product_obj.get('pr_fit', '')
            garment_length = product_obj.get('pr_garment_length', '')
            sleeve_length = product_obj.get('pr_sleeve_length', '')
            neckline = product_obj.get('pr_neckline_style')
            if isinstance(neckline, list) and neckline:
                collar_style = neckline[0]
            elif isinstance(neckline, str):
                collar_style = neckline

        # Fallback for composition if not in __NEXT_DATA__
        if not composition:
            comp_section = soup.find("div", class_=re.compile(r"composition|material", re.I))
            if comp_section:
                composition.append(comp_section.get_text(" ", strip=True))
            else:
                comp_heading = soup.find(string=re.compile(r"Composition", re.I))
                if comp_heading:
                    parent = comp_heading.find_parent()
                    if parent and parent.find_next_sibling():
                        composition.append(parent.find_next_sibling().get_text(strip=True))

        # Fallback for supplier if not in __NEXT_DATA__
        if not factory_name:
            materials_heading = soup.find(string=re.compile(r"Materials and Suppliers", re.I))
            if materials_heading:
                parent = materials_heading.find_parent()
                if parent:
                    content_div = parent.find_next_sibling("div")
                    if content_div:
                        text = content_div.get_text("\n", strip=True)
                        lines = [line for line in text.split("\n") if line]
                        if lines:
                            factory_name = lines[0]
                            if len(lines) > 1:
                                factory_address = lines[1]
                            if len(lines) > 2:
                                factory_country = lines[2]
                        emp_match = re.search(r"(\d+)\s*employees?", text, re.I)
                        if emp_match:
                            factory_employees = emp_match.group(1)

        # Build details dict (remove empty values)
        details = {
            "clothing_style": clothing_style,
            "fit": fit,
            "garment_length": garment_length,
            "sleeve_length": sleeve_length,
            "collar_style": collar_style,
        }
        details = {k: v for k, v in details.items() if v}

        # Assemble final product dictionary in clean order
        product_data = {
            "style_number": None,   # will be set in scrape()
            "product_name": product_name,
            "price": price,
            "description": description,
            "details": details,
        }

        if composition:
            product_data["composition"] = composition
        if care_instructions:
            product_data["care_instructions"] = care_instructions

        # Factory info only if we have at least a name
        if factory_name:
            product_data["factory_name"] = factory_name
            if factory_address:
                product_data["factory_address"] = factory_address
            if factory_country:
                product_data["factory_country"] = factory_country
            if factory_employees:
                product_data["factory_employees"] = factory_employees

        product_data["product_url"] = url
        return product_data

    def scrape(self, style_number):
        product_url = self.search_product(style_number)
        data = self.parse_product_page(product_url)
        data["style_number"] = style_number
        # Coordinates are omitted entirely – they will not appear in the output
        return data

# ----------------------------------------------------------------------
# 3. Main: combine OCR + scraping + timestamped JSON save
# ----------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="COS Supply Chain Data Extractor – from label photo to JSON.")
    parser.add_argument("image", help="Path to the label image (e.g., /path/to/IMG_5991.JPG)")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(f"❌ Image file not found: {args.image}")
        sys.exit(1)

    # --- Step 1: Extract style number ---
    style = extract_style_number(args.image)
    if style:
        print(f"\n✅ Extracted style number: {style}")
    else:
        print("\n⚠️  Automatic extraction failed.")
        manual = input("Please enter the style number manually (10 digits): ").strip()
        if re.match(r'^\d{10}$', manual):
            style = manual
            print(f"✅ Using manual entry: {style}")
        else:
            print("❌ Invalid input. Exiting.")
            sys.exit(1)

    # --- Step 2: Scrape product page ---
    print("\n" + "="*60)
    print("STEP 2: Scraping product page")
    print("="*60)
    scraper = COSScraper()
    result = scraper.scrape(style)

    # --- Step 3: Save timestamped JSON ---
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"COS_{style}_{timestamp}.json"
    os.makedirs(PRE_DATA_DIR, exist_ok=True)
    output_path = os.path.join(PRE_DATA_DIR, filename)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print("\n" + "="*60)
    print("✅ FINISHED – Data saved to", output_path)
    print("="*60)
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
