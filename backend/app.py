# backend/app.py
from flask import Flask, jsonify, request
import cv2
from pyzbar.pyzbar import decode
import numpy as np
import mysql.connector
from flask_cors import CORS
import logging
import time

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

try:
    db = mysql.connector.connect(
        host="localhost",
        user="root",
        password="saketh21@vce",
        database="nexcart"
    )
    cursor = db.cursor()
except mysql.connector.Error as err:
    logging.error(f"Error connecting to MySQL: {err}")
    exit(1)

scanned_product = None
is_scanning = False
scanned_products = set()
last_scan_times = {}

def detect_barcode(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    codes = decode(gray)
    return codes

@app.route('/start-video-feed', methods=['POST'])
def start_video_feed():
    global scanned_product, is_scanning
    is_scanning = True
    cap = cv2.VideoCapture(0)  # Try different indexes if 0 doesn't work

    cap.set(cv2.CAP_PROP_FPS, 60)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

    while is_scanning:
        ret, img = cap.read()
        if not ret:
            logging.warning("Failed to read frame from camera.")
            break

        codes = detect_barcode(img)

        if codes:
            for code in codes:
                data = code.data.decode('utf-8')
                current_time = time.time()
                if data in last_scan_times and current_time - last_scan_times[data] < 10:
                    logging.info(f"Product ID {data} scanned within 10 seconds. Ignoring...")
                    continue

                try:
                    cursor.execute("SELECT product_name, price FROM products WHERE product_id = %s", (data,))
                    product = cursor.fetchone()
                    if product:
                        name, price = product
                        scanned_product = {'name': name, 'price': float(price)}
                        scanned_products.add(data)
                        last_scan_times[data] = current_time
                        logging.info(f"Detected product: {name} - ${price}")
                        print(f"Scanned Product: {name}, Price: {price}")  # Print to terminal
                        time.sleep(2)
                    else:
                        logging.warning(f"Product with ID {data} not found in the database.")
                except mysql.connector.Error as err:
                    logging.error(f"Database error: {err}")

        cv2.imshow("Barcode/QR Code Scanner", img)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            is_scanning = False

    cap.release()
    cv2.destroyAllWindows()
    return jsonify({'message': 'Scanning stopped'}), 200

@app.route('/checkout', methods=['POST'])
def checkout():
    global is_scanning, scanned_products
    is_scanning = False
    products = []

    for product_id in scanned_products:
        try:
            cursor.execute("SELECT product_name, price FROM products WHERE product_id = %s", (product_id,))
            product = cursor.fetchone()
            if product:
                name, price = product
                products.append({'name': name, 'price': float(price)})
                print(f"Product: {name}, Price: {price}")  # Print to terminal
            else:
                logging.warning(f"Product with ID {product_id} not found in database during checkout.")
        except mysql.connector.Error as err:
            logging.error(f"Database error: {err}")

    scanned_products.clear()  # Clear after checkout
    return jsonify({'message': 'Checkout completed', 'products': products}), 200

@app.route('/get-product', methods=['GET'])
def get_product_details():
    global scanned_product
    if scanned_product:
        product_to_return = scanned_product
        scanned_product = None
        return jsonify(product_to_return), 200
    else:
        return jsonify({'message': 'No product detected yet'}), 404

if __name__ == '__main__':
    app.run(port=5000)

