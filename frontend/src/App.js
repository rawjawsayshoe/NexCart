import React, { useState, useEffect } from "react";
import "./App.css";

// Updated recommendations with available brands
const productRecommendations = {
  "Bread": [{ name: "Jam", floor: 1, row: 3, brands: ["Brand A", "Brand B"] }, { name: "Butter", floor: 1, row: 2, brands: ["Brand C"] }, { name: "Peanut Butter", floor: 1, row: 4, brands: ["Brand D", "Brand E"] }],
  "Ponds Cream": [{ name: "Fogg Scent", floor: 2, row: 1, brands: ["Brand F"] }, { name: "Hand Sanitizer", floor: 2, row: 2, brands: ["Brand G", "Brand H"] }, { name: "Body Lotion", floor: 2, row: 3, brands: ["Brand I"] }, { name: "Moisturizer", floor: 2, row: 4, brands: ["Brand J", "Brand K"] }],
  "Fogg Scent": [{ name: "Ponds Cream", floor: 2, row: 1, brands: ["Brand L"] }, { name: "Deodorant", floor: 2, row: 2, brands: ["Brand M"] }, { name: "Shower Gel", floor: 2, row: 3, brands: ["Brand N"] }],
  "Eta Dishwash": [{ name: "Sponges", floor: 3, row: 1, brands: ["Brand O"] }, { name: "Gloves", floor: 3, row: 2, brands: ["Brand P", "Brand Q"] }, { name: "Hand Wash", floor: 3, row: 3, brands: ["Brand R"] }],
  "Water Bottle": [{ name: "Tiffin Box", floor: 4, row: 1, brands: ["Brand S"] }, { name: "Sports Drink", floor: 4, row: 2, brands: ["Brand T", "Brand U"] }, { name: "Reusable Straw", floor: 4, row: 3, brands: ["Brand V"] }],
  "Surf Excel": [{ name: "Eta Dishwash", floor: 5, row: 1, brands: ["Brand W"] }, { name: "Fabric Softener", floor: 5, row: 2, brands: ["Brand X"] }, { name: "Bleach", floor: 5, row: 3, brands: ["Brand Y", "Brand Z"] }]
};

const App = () => {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [recentlyScanned, setRecentlyScanned] = useState({});
  const [notification, setNotification] = useState("");
  const [isAddMode, setIsAddMode] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [checklist, setChecklist] = useState([]); // For the checklist
  const [newItem, setNewItem] = useState(""); // For new checklist item

  // Start video feed by calling the backend
  const startVideoFeed = async () => {
    try {
      setLoading(true);
      setIsScanning(true);
      await fetch("http://127.0.0.1:5000/start-video-feed", { method: "POST" });
    } catch (error) {
      console.error("Error starting video feed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Checkout the cart by calling the backend
  const checkout = async () => {
    setIsScanning(false);
    try {
      const response = await fetch("http://127.0.0.1:5000/checkout", {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setCart(data.products); // Update cart with backend data after checkout
        showNotification("Checkout completed!");
        setRecommendations([]); // Clear recommendations after checkout
      } else {
        console.error("Error during checkout.");
      }
    } catch (error) {
      console.error("Error during checkout:", error);
    }
  };

  // Fetch the latest scanned product details
  const fetchProductDetails = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/get-product");
      if (response.ok) {
        const data = await response.json();
        handleProductScan(data); // Call the handler with product data
      } else {
        console.log("No product detected yet");
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
    }
  };

  // Handle product scan and manage cart (Add/Remove mode)
  const handleProductScan = (product) => {
    const now = Date.now();

    if (!product || !product.name || !product.price) {
      console.error("Invalid product data");
      return;
    }

    // Ignore if recently scanned
    if (recentlyScanned[product.name] && now - recentlyScanned[product.name] < 10000) {
      console.log("Product scanned within 10 seconds. Ignoring...");
      return;
    }

    setCart((prevCart) => {
      const updatedCart = [...prevCart];
      const productIndex = updatedCart.findIndex((item) => item.name === product.name);

      if (isAddMode) {
        if (productIndex >= 0) {
          updatedCart[productIndex].quantity += 1;
        } else {
          updatedCart.push({ ...product, quantity: 1 });
        }
        showNotification(`Added ${product.name} to cart`);

        // Set recommendations
        if (productRecommendations[product.name]) {
          setRecommendations(productRecommendations[product.name]);
        }

        // Cross off checklist item if it's there
        setChecklist((prevChecklist) =>
          prevChecklist.map((item) =>
            item.name === product.name ? { ...item, checked: true } : item
          )
        );
      } else {
        if (productIndex >= 0) {
          updatedCart[productIndex].quantity -= 1;
          if (updatedCart[productIndex].quantity <= 0) {
            updatedCart.splice(productIndex, 1); // Remove if quantity is 0
          }
          showNotification(`Removed ${product.name} from cart`);
        } else {
          showNotification(`${product.name} not in cart to remove`);
        }
        setRecommendations([]); // Clear recommendations on remove
      }

      return updatedCart;
    });

    setRecentlyScanned((prevState) => ({
      ...prevState,
      [product.name]: now,
    }));
  };

  // Show a notification message
  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => {
      setNotification("");
    }, 3000);
  };

  // Toggle between Add and Remove modes
  const handleModeChange = () => {
    setIsAddMode(!isAddMode); // Switch mode
  };

  // Poll for product details while scanning
  useEffect(() => {
    let intervalId;
    if (isScanning) {
      intervalId = setInterval(fetchProductDetails, 3000);
    }
    return () => clearInterval(intervalId); // Cleanup on unmount or stop scanning
  }, [isScanning]);

  // Add item to checklist
  const addItemToChecklist = () => {
    if (newItem) {
      setChecklist((prevChecklist) => [
        ...prevChecklist,
        { name: newItem, checked: false },
      ]);
      setNewItem("");
    }
  };

  return (
    <div className="app-container">
      <h1 className="header">NexCart</h1>
      {notification && <div className="notification-popup">{notification}</div>}

      <div className="controls">
        <button
          className="start-scan-btn"
          onClick={startVideoFeed}
          disabled={isScanning || loading}
        >
          {loading ? "Starting..." : "Start Scanning"}
        </button>

        <div className="toggle-switch-container">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isAddMode}
              onChange={handleModeChange}
            />
            <span className="slider"></span>
          </label>
          <span className="toggle-label">
            {isAddMode ? "Add Mode" : "Remove Mode"}
          </span>
        </div>
      </div>

      {/* Checklist Section */}
      <div className="checklist-container">
        <h2>Checklist</h2>
        <div className="checklist-input">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add a product"
          />
          <button onClick={addItemToChecklist}>Add</button>
        </div>
        <ul className="checklist">
          {checklist.map((item, index) => (
            <li key={index} className={item.checked ? "checked" : ""}>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() =>
                  setChecklist((prevChecklist) =>
                    prevChecklist.map((i, idx) =>
                      idx === index ? { ...i, checked: !i.checked } : i
                    )
                  )
                }
              />
              {item.name}
            </li>
          ))}
        </ul>
      </div>

      {/* Cart Section */}
      <div className="cart-container">
        <h2>Cart</h2>
        <table className="cart-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Price</th>
              <th>Quantity</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((product) => (
              <tr key={product.name}>
                <td>{product.name}</td>
                <td>${product.price.toFixed(2)}</td>
                <td>{product.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="total">
          <h3>
            Total: $
            {cart
              .reduce(
                (total, product) => total + product.price * product.quantity,
                0
              )
              .toFixed(2)}
          </h3>
        </div>
      </div>

      {/* Product Recommendations */}
      {recommendations.length > 0 && (
        <div className="recommendations">
          <h3>Recommended Products</h3>
          <div className="recommendations-grid">
            {recommendations.map((item) => (
              <div key={item.name} className="recommendation-card">
                {item.name}
                <div className="tooltip">
                  Floor: {item.floor}, Row: {item.row}
                  <br />
                  Available Brands: {item.brands.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Checkout Button */}
      <button
        className="checkout-btn"
        onClick={checkout}
        disabled={cart.length === 0} // Disable if cart is empty
      >
        Checkout
      </button>
    </div>
  );
};

export default App;
