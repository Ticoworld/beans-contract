(define-fungible-token mock-token)

(define-public (transfer (amount uint) (from principal) (to principal))
  (begin
    (asserts! (> amount u0) (err u2))
    (asserts! (not (is-eq from to)) (err u3))
    (asserts! (is-eq tx-sender from) (err u1))
    (ft-transfer? mock-token amount from to)
  )
)

(define-public (mint (amount uint) (recipient principal))
  (ft-mint? mock-token amount recipient)
)

(define-read-only (get-name) (ok "Mock Token"))
(define-read-only (get-symbol) (ok "MOCK"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (account principal)) (ok (ft-get-balance mock-token account)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock-token)))
(define-read-only (get-token-uri) (ok none))