class PayOSGateway:
    """Small adapter around the official PayOS Python SDK for testability."""

    def __init__(self, client_id: str = "", api_key: str = "", checksum_key: str = ""):
        self.configured = bool(client_id and api_key and checksum_key)
        self.client = None
        if self.configured:
            from payos import PayOS
            self.client = PayOS(client_id=client_id, api_key=api_key, checksum_key=checksum_key)

    def create(self, order_code: int, amount: int, description: str, return_url: str, cancel_url: str):
        from payos.types import CreatePaymentLinkRequest
        response = self.client.payment_requests.create(CreatePaymentLinkRequest(
            orderCode=order_code, amount=amount, description=description[:25],
            returnUrl=return_url, cancelUrl=cancel_url,
        ))
        return {"payment_link_id": response.payment_link_id, "checkout_url": response.checkout_url, "qr_code": getattr(response, "qr_code", "")}

    def verify(self, raw: bytes):
        event = self.client.webhooks.verify(raw)
        return {"order_code": event.order_code, "amount": event.amount, "code": event.code,
                "reference": event.reference, "currency": event.currency,
                "payment_link_id": event.payment_link_id}

    def status(self, order_code: int):
        status = self.client.payment_requests.get(order_code).status
        return getattr(status, "value", status)
