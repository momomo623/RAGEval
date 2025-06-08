"""
RAG代理端点 - 解决HTTPS环境下访问HTTP服务的混合内容问题
"""

import asyncio
import json
import time
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User

router = APIRouter()


class RAGProxyRequest(BaseModel):
    """RAG代理请求模型"""
    url: str
    method: str = "POST"
    headers: Dict[str, str] = {}
    body: Optional[Dict[str, Any]] = None
    timeout: int = 60


@router.post("/proxy")
async def proxy_rag_request(
    request: RAGProxyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    代理RAG请求到HTTP服务
    支持流式和非流式响应
    """
    
    async def generate_response():
        try:
            # 设置超时
            timeout = httpx.Timeout(request.timeout)
            
            async with httpx.AsyncClient(timeout=timeout) as client:
                # 准备请求参数
                req_kwargs = {
                    "method": request.method,
                    "url": request.url,
                    "headers": request.headers,
                }
                
                if request.body:
                    req_kwargs["json"] = request.body
                
                # 检查是否为流式请求
                content_type = request.headers.get('Accept', '')
                is_stream = 'text/event-stream' in content_type or 'stream' in str(request.body).lower()
                
                if is_stream:
                    # 流式请求
                    async with client.stream(**req_kwargs) as response:
                        if response.status_code != 200:
                            error_text = await response.aread()
                            yield f"data: {json.dumps({'error': f'HTTP {response.status_code}: {error_text.decode()}'})}\n\n"
                            return
                        
                        # 转发流式响应
                        async for chunk in response.aiter_bytes():
                            if chunk:
                                yield chunk.decode('utf-8', errors='ignore')
                else:
                    # 非流式请求
                    response = await client.request(**req_kwargs)
                    
                    if response.status_code != 200:
                        error_text = response.text
                        yield json.dumps({'error': f'HTTP {response.status_code}: {error_text}'})
                        return
                    
                    # 返回完整响应
                    yield response.text
                    
        except httpx.TimeoutException:
            yield json.dumps({'error': '请求超时'})
        except httpx.ConnectError:
            yield json.dumps({'error': '无法连接到目标服务'})
        except Exception as e:
            yield json.dumps({'error': f'代理请求失败: {str(e)}'})
    
    # 检查请求类型设置响应头
    content_type = request.headers.get('Accept', '')
    is_stream = 'text/event-stream' in content_type or 'stream' in str(request.body).lower()
    
    if is_stream:
        headers = {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    else:
        headers = {
            "Content-Type": "application/json",
        }
    
    return StreamingResponse(
        generate_response(),
        headers=headers
    )


@router.post("/proxy/test")
async def test_rag_proxy(
    request: RAGProxyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    测试RAG代理连接
    """
    try:
        timeout = httpx.Timeout(10)  # 测试时使用较短超时
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            req_kwargs = {
                "method": request.method,
                "url": request.url,
                "headers": request.headers,
            }
            
            if request.body:
                req_kwargs["json"] = request.body
            
            start_time = time.time()
            response = await client.request(**req_kwargs)
            response_time = time.time() - start_time
            
            return {
                "success": True,
                "status_code": response.status_code,
                "response_time": round(response_time * 1000, 2),  # 毫秒
                "content_length": len(response.content),
                "content_preview": response.text[:200] if response.text else "",
                "headers": dict(response.headers)
            }
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "error": "连接超时",
            "error_type": "timeout"
        }
    except httpx.ConnectError as e:
        return {
            "success": False,
            "error": f"连接失败: {str(e)}",
            "error_type": "connection"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"请求失败: {str(e)}",
            "error_type": "unknown"
        } 