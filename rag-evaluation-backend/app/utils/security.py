import secrets
import string

def generate_api_key_token(length: int = 32) -> str:
    """
    生成随机API密钥令牌
    """
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length)) 