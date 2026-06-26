import { useState, useEffect, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || ''

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function ProductCard({ product }) {
  return (
    <div className="card">
      <div className="card-name">{product.name}</div>
      <div className="card-meta">
        <span className="card-category">{product.category}</span>
        <span className="card-price">${product.price.toFixed(2)}</span>
      </div>
      <div className="card-date">Added {formatDate(product.createdAt)}</div>
    </div>
  )
}

export default function App() {
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(null)

  // Cursor stack: index 0 = first page (no cursor), index N = cursor for page N+1
  // To go back we pop from the stack.
  const [cursorStack, setCursorStack] = useState([null]) // null = first page
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [nextCursor, setNextCursor] = useState(null)

  // Fetch categories & total on mount
  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(console.error)

    fetch(`${API}/api/stats`)
      .then(r => r.json())
      .then(d => setTotalCount(d.total))
      .catch(console.error)
  }, [])

  // Fetch products whenever category or page changes
  const fetchProducts = useCallback(async (cursor, category) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category && category !== 'all') params.set('category', category)
      if (cursor) params.set('cursor', cursor)

      const res = await fetch(`${API}/api/products?${params}`)
      const data = await res.json()

      setProducts(data.products || [])
      setNextCursor(data.nextCursor || null)
    } catch (err) {
      console.error('Failed to fetch products:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // When category changes, reset pagination
  useEffect(() => {
    setCursorStack([null])
    setCurrentPageIndex(0)
    setNextCursor(null)
    fetchProducts(null, activeCategory)
  }, [activeCategory, fetchProducts])

  function goNext() {
    if (!nextCursor) return
    const newStack = [...cursorStack, nextCursor]
    setCursorStack(newStack)
    const newIndex = currentPageIndex + 1
    setCurrentPageIndex(newIndex)
    fetchProducts(nextCursor, activeCategory)
  }

  function goPrev() {
    if (currentPageIndex === 0) return
    const newIndex = currentPageIndex - 1
    setCurrentPageIndex(newIndex)
    // Previous page cursor is one before current in the stack
    const prevCursor = cursorStack[newIndex]
    fetchProducts(prevCursor, activeCategory)
  }

  function handleCategoryChange(cat) {
    if (cat === activeCategory) return
    setActiveCategory(cat)
  }

  const currentPage = currentPageIndex + 1
  const hasNext = !!nextCursor
  const hasPrev = currentPageIndex > 0

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <span className="logo">⚡ ProductBrowse</span>
          {totalCount !== null && (
            <span className="stat-badge">
              {totalCount.toLocaleString()} products
            </span>
          )}
        </div>
      </header>

      <nav className="filter-bar">
        <div className="filter-bar-inner">
          <span className="filter-label">Category:</span>
          <button
            className={`cat-btn ${activeCategory === 'all' ? 'active' : ''}`}
            onClick={() => handleCategoryChange('all')}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`cat-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      <main className="main">
        {loading ? (
          <div className="state-center">
            <div className="spinner" />
            <span>Loading products...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="state-center">
            <span className="empty-icon">📦</span>
            <span>No products found</span>
          </div>
        ) : (
          <div className="grid">
            {products.map(p => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}

        {!loading && products.length > 0 && (
          <div className="pagination">
            <button className="btn" onClick={goPrev} disabled={!hasPrev}>
              ← Previous
            </button>
            <span className="page-info">Page {currentPage}</span>
            <button className="btn btn-primary" onClick={goNext} disabled={!hasNext}>
              Next →
            </button>
          </div>
        )}
      </main>
    </>
  )
}
