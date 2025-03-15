from typing import List, Dict, Any, Optional, Union
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_, or_
import uuid
import json
from datetime import datetime

from app.models.report import Report
from app.models.project import Project, EvaluationDimension
from app.models.question import Question
from app.models.rag_answer import RagAnswer
from app.models.evaluation import Evaluation
from app.schemas.report import (
    ReportCreate, 
    ReportUpdate,
    EvaluationReportContent,
    EvaluationReportDimensionResult,
    EvaluationReportSystemResult,
    PerformanceReportContent
)
from app.services.evaluation_service import EvaluationService

class ReportService:
    """报告服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create_report(
        self, 
        user_id: str,
        obj_in: ReportCreate,
        generate_content: bool = True
    ) -> Report:
        """创建报告"""
        db_obj = Report(
            user_id=user_id,
            project_id=obj_in.project_id,
            title=obj_in.title,
            description=obj_in.description,
            report_type=obj_in.report_type,
            public=obj_in.public,
            config=obj_in.config
        )
        
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        
        # 自动生成报告内容
        if generate_content:
            self.generate_report_content(str(db_obj.id))
        
        return db_obj
    
    def update_report(
        self,
        report_id: str, 
        obj_in: ReportUpdate,
        regenerate_content: bool = False
    ) -> Optional[Report]:
        """更新报告"""
        db_obj = self.db.query(Report).filter(Report.id == report_id).first()
        if not db_obj:
            return None
        
        update_data = obj_in.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        
        # 如果需要，重新生成报告内容
        if regenerate_content:
            self.generate_report_content(report_id)
        
        return db_obj
    
    def delete_report(self, report_id: str) -> bool:
        """删除报告"""
        db_obj = self.db.query(Report).filter(Report.id == report_id).first()
        if not db_obj:
            return False
        
        self.db.delete(db_obj)
        self.db.commit()
        return True
    
    def get_report(self, report_id: str) -> Optional[Report]:
        """获取单个报告"""
        return self.db.query(Report).filter(Report.id == report_id).first()
    
    def get_reports_by_project(
        self, 
        project_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Report]:
        """获取项目的所有报告"""
        return self.db.query(Report).filter(
            Report.project_id == project_id
        ).order_by(desc(Report.created_at)).offset(skip).limit(limit).all()
    
    def get_reports_by_user(
        self, 
        user_id: str,
        skip: int = 0,
        limit: int = 100
    ) -> List[Report]:
        """获取用户的所有报告"""
        return self.db.query(Report).filter(
            Report.user_id == user_id
        ).order_by(desc(Report.created_at)).offset(skip).limit(limit).all()
    
    def get_public_reports(
        self,
        skip: int = 0,
        limit: int = 20
    ) -> List[Report]:
        """获取公开的报告"""
        return self.db.query(Report).filter(
            Report.public == True
        ).order_by(desc(Report.created_at)).offset(skip).limit(limit).all()
    
    def generate_report_content(self, report_id: str) -> bool:
        """生成报告内容"""
        report = self.db.query(Report).filter(Report.id == report_id).first()
        if not report:
            return False
        
        # 根据报告类型生成不同的内容
        if report.report_type == "evaluation":
            content = self._generate_evaluation_report(report)
        elif report.report_type == "performance":
            content = self._generate_performance_report(report)
        elif report.report_type == "comparison":
            content = self._generate_comparison_report(report)
        else:
            return False
        
        # 更新报告内容
        report.content = content
        report.updated_at = datetime.now()
        self.db.add(report)
        self.db.commit()
        
        return True
    
    def _generate_evaluation_report(self, report: Report) -> Dict[str, Any]:
        """生成评测报告内容"""
        # 获取项目信息
        project = self.db.query(Project).filter(Project.id == report.project_id).first()
        if not project:
            return {"error": "项目未找到"}
        
        # 获取项目的所有问题
        questions = self.db.query(Question).filter(Question.project_id == report.project_id).all()
        if not questions:
            return {"error": "项目中没有问题"}
        
        question_ids = [str(q.id) for q in questions]
        
        # 获取评测维度
        dimensions = self.db.query(EvaluationDimension).filter(
            EvaluationDimension.project_id == report.project_id
        ).all()
        
        if not dimensions:
            return {"error": "项目没有设置评测维度"}
        
        # 获取所有RAG回答的来源系统
        rag_systems = self.db.query(RagAnswer.source_system).filter(
            RagAnswer.question_id.in_(question_ids)
        ).distinct().all()
        rag_systems = [r[0] for r in rag_systems if r[0]]
        
        if not rag_systems:
            return {"error": "没有找到RAG系统回答"}
        
        # 获取所有评测结果
        evaluations = self.db.query(Evaluation).filter(
            Evaluation.question_id.in_(question_ids)
        ).all()
        
        if not evaluations:
            return {"error": "没有找到评测结果"}
        
        # 计算每个维度的评测结果
        dimension_results = []
        
        for dim in dimensions:
            # 获取该维度的所有评测
            dim_evals = [e for e in evaluations if str(e.dimension_id) == str(dim.id)]
            
            if not dim_evals:
                continue
            
            scores = [e.score for e in dim_evals]
            avg_score = sum(scores) / len(scores)
            
            # 计算分数分布
            distribution = {}
            for score in range(1, 6):  # 假设使用1-5分制
                count = len([s for s in scores if int(s) == score])
                distribution[str(score)] = count
            
            dim_result = {
                "dimension_id": str(dim.id),
                "dimension_name": dim.display_name,
                "average_score": round(avg_score, 2),
                "distribution": distribution,
                "weight": dim.weight
            }
            
            dimension_results.append(dim_result)
        
        # 计算每个系统的评测结果
        system_results = []
        
        for system in rag_systems:
            # 获取该系统的所有回答ID
            system_answers = self.db.query(RagAnswer).filter(
                RagAnswer.question_id.in_(question_ids),
                RagAnswer.source_system == system
            ).all()
            
            if not system_answers:
                continue
            
            system_answer_ids = [str(a.id) for a in system_answers]
            
            # 获取这些回答的评测结果
            system_evals = [e for e in evaluations if str(e.rag_answer_id) in system_answer_ids]
            
            if not system_evals:
                continue
            
            # 计算总体平均分
            all_scores = [e.score for e in system_evals]
            avg_score = sum(all_scores) / len(all_scores) if all_scores else 0
            
            # 计算每个维度的平均分
            dimension_scores = []
            
            for dim in dimensions:
                dim_evals = [e for e in system_evals if str(e.dimension_id) == str(dim.id)]
                
                if not dim_evals:
                    continue
                
                dim_scores = [e.score for e in dim_evals]
                dim_avg = sum(dim_scores) / len(dim_scores) if dim_scores else 0
                
                dimension_scores.append({
                    "dimension_name": dim.display_name,
                    "dimension_id": str(dim.id),
                    "average_score": round(dim_avg, 2),
                    "count": len(dim_evals),
                    "weight": dim.weight
                })
            
            system_results.append({
                "system_name": system,
                "average_score": round(avg_score, 2),
                "dimension_scores": dimension_scores,
                "question_count": len(set(e.question_id for e in system_evals)),
                "evaluation_count": len(system_evals)
            })
        
        # 排序系统结果
        system_results.sort(key=lambda x: x["average_score"], reverse=True)
        
        # 计算总体平均分
        all_scores = [e.score for e in evaluations]
        total_score = sum(all_scores) / len(all_scores) if all_scores else 0
        
        # 生成改进建议
        improvement_suggestions = self._generate_improvement_suggestions(
            dimensions, dimension_results, system_results
        )
        
        # 构建报告内容
        content = {
            "project_id": str(report.project_id),
            "project_name": project.name,
            "total_score": round(total_score, 2),
            "question_count": len(questions),
            "evaluated_count": len(set(e.question_id for e in evaluations)),
            "dimension_results": dimension_results,
            "system_results": system_results,
            "improvement_suggestions": improvement_suggestions,
            "generated_at": datetime.now().isoformat()
        }
        
        return content
    
    def _generate_performance_report(self, report: Report) -> Dict[str, Any]:
        """生成性能报告内容"""
        # 获取项目信息
        project = self.db.query(Project).filter(Project.id == report.project_id).first()
        if not project:
            return {"error": "项目未找到"}
        
        # 获取项目的所有问题
        questions = self.db.query(Question).filter(Question.project_id == report.project_id).all()
        if not questions:
            return {"error": "项目中没有问题"}
        
        question_ids = [str(q.id) for q in questions]
        
        # 获取所有RAG回答
        rag_answers = self.db.query(RagAnswer).filter(
            RagAnswer.question_id.in_(question_ids)
        ).all()
        
        if not rag_answers:
            return {"error": "没有找到RAG回答"}
        
        # 获取所有系统
        systems = set(a.source_system for a in rag_answers if a.source_system)
        
        # 计算性能指标
        first_response_times = [a.first_response_time for a in rag_answers if a.first_response_time]
        total_response_times = [a.total_response_time for a in rag_answers if a.total_response_time]
        char_per_second = [a.characters_per_second for a in rag_answers if a.characters_per_second]
        
        # 计算平均值
        avg_first_time = sum(first_response_times) / len(first_response_times) if first_response_times else 0
        avg_total_time = sum(total_response_times) / len(total_response_times) if total_response_times else 0
        avg_char_speed = sum(char_per_second) / len(char_per_second) if char_per_second else 0
        
        # 计算响应时间分布
        time_distribution = {}
        
        # 设置时间范围
        time_ranges = [
            (0, 500),      # 0-500ms
            (500, 1000),   # 500ms-1s
            (1000, 2000),  # 1-2s
            (2000, 5000),  # 2-5s
            (5000, 10000), # 5-10s
            (10000, float('inf'))  # >10s
        ]
        
        # 统计每个范围的回答数量
        for start, end in time_ranges:
            if end == float('inf'):
                label = f">{start/1000}s"
            else:
                label = f"{start/1000}-{end/1000}s"
            
            count = len([t for t in total_response_times if start <= t < end])
            time_distribution[label] = count
        
        # 计算每个系统的性能比较
        system_comparison = []
        
        for system in systems:
            system_answers = [a for a in rag_answers if a.source_system == system]
            
            # 计算该系统的性能指标
            s_first_times = [a.first_response_time for a in system_answers if a.first_response_time]
            s_total_times = [a.total_response_time for a in system_answers if a.total_response_time]
            s_char_speeds = [a.characters_per_second for a in system_answers if a.characters_per_second]
            
            s_avg_first = sum(s_first_times) / len(s_first_times) if s_first_times else 0
            s_avg_total = sum(s_total_times) / len(s_total_times) if s_total_times else 0
            s_avg_speed = sum(s_char_speeds) / len(s_char_speeds) if s_char_speeds else 0
            
            system_comparison.append({
                "system_name": system,
                "answer_count": len(system_answers),
                "avg_first_response_time": round(s_avg_first, 2),
                "avg_total_response_time": round(s_avg_total, 2),
                "avg_characters_per_second": round(s_avg_speed, 2)
            })
        
        # 按总响应时间排序
        system_comparison.sort(key=lambda x: x["avg_total_response_time"])
        
        # 构建报告内容
        content = {
            "project_id": str(report.project_id),
            "project_name": project.name,
            "total_questions": len(questions),
            "total_answers": len(rag_answers),
            "avg_first_response_time": round(avg_first_time, 2),
            "avg_total_response_time": round(avg_total_time, 2),
            "avg_characters_per_second": round(avg_char_speed, 2),
            "response_time_distribution": time_distribution,
            "system_comparison": system_comparison,
            "generated_at": datetime.now().isoformat()
        }
        
        return content
    
    def _generate_comparison_report(self, report: Report) -> Dict[str, Any]:
        """生成系统比较报告内容"""
        # 获取项目信息
        project = self.db.query(Project).filter(Project.id == report.project_id).first()
        if not project:
            return {"error": "项目未找到"}
        
        # 获取项目的所有问题
        questions = self.db.query(Question).filter(Question.project_id == report.project_id).all()
        if not questions:
            return {"error": "项目中没有问题"}
        
        question_ids = [str(q.id) for q in questions]
        
        # 获取评测维度
        dimensions = self.db.query(EvaluationDimension).filter(
            EvaluationDimension.project_id == report.project_id
        ).all()
        
        if not dimensions:
            return {"error": "项目没有设置评测维度"}
        
        # 获取比较的系统
        systems_to_compare = report.config.get("systems", [])
        if not systems_to_compare:
            # 如果没有指定，则获取所有系统
            systems = self.db.query(RagAnswer.source_system).filter(
                RagAnswer.question_id.in_(question_ids)
            ).distinct().all()
            systems_to_compare = [s[0] for s in systems if s[0]]
        
        if not systems_to_compare:
            return {"error": "没有找到需要比较的系统"}
        
        # 获取所有评测结果
        evaluations = self.db.query(Evaluation).filter(
            Evaluation.question_id.in_(question_ids)
        ).all()
        
        if not evaluations:
            return {"error": "没有找到评测结果"}
        
        # 获取所有回答
        rag_answers = self.db.query(RagAnswer).filter(
            RagAnswer.question_id.in_(question_ids),
            RagAnswer.source_system.in_(systems_to_compare)
        ).all()
        
        # 构建系统对比数据
        dimension_comparisons = []
        
        for dim in dimensions:
            systems_data = []
            
            for system in systems_to_compare:
                # 获取该系统的所有回答ID
                system_answers = [a for a in rag_answers if a.source_system == system]
                system_answer_ids = [str(a.id) for a in system_answers]
                
                # 获取该维度下该系统的评测结果
                system_dim_evals = [
                    e for e in evaluations 
                    if str(e.dimension_id) == str(dim.id) and str(e.rag_answer_id) in system_answer_ids
                ]
                
                if not system_dim_evals:
                    continue
                
                # 计算平均分
                scores = [e.score for e in system_dim_evals]
                avg_score = sum(scores) / len(scores) if scores else 0
                
                systems_data.append({
                    "system_name": system,
                    "average_score": round(avg_score, 2),
                    "evaluation_count": len(system_dim_evals)
                })
            
            # 按分数排序
            systems_data.sort(key=lambda x: x["average_score"], reverse=True)
            
            dimension_comparisons.append({
                "dimension_id": str(dim.id),
                "dimension_name": dim.display_name,
                "systems": systems_data,
                "weight": dim.weight
            })
        
        # 计算总体排名
        overall_ranking = []
        
        for system in systems_to_compare:
            system_answers = [a for a in rag_answers if a.source_system == system]
            system_answer_ids = [str(a.id) for a in system_answers]
            
            # 获取所有评测结果
            system_evals = [e for e in evaluations if str(e.rag_answer_id) in system_answer_ids]
            
            if not system_evals:
                continue
            
            # 计算总分和加权总分
            total_score = 0
            weighted_score = 0
            total_weight = 0
            
            # 按维度计算
            for dim in dimensions:
                dim_evals = [e for e in system_evals if str(e.dimension_id) == str(dim.id)]
                
                if not dim_evals:
                    continue
                
                # 计算该维度平均分
                dim_scores = [e.score for e in dim_evals]
                dim_avg = sum(dim_scores) / len(dim_scores) if dim_scores else 0
                
                # 加权计算
                weighted_score += dim_avg * dim.weight
                total_weight += dim.weight
            
            # 计算最终得分
            final_score = weighted_score / total_weight if total_weight > 0 else 0
            
            # 获取性能数据
            perf_data = {
                "first_response_time": 0,
                "total_response_time": 0,
                "characters_per_second": 0
            }
            
            first_times = [a.first_response_time for a in system_answers if a.first_response_time]
            total_times = [a.total_response_time for a in system_answers if a.total_response_time]
            char_speeds = [a.characters_per_second for a in system_answers if a.characters_per_second]
            
            if first_times:
                perf_data["first_response_time"] = round(sum(first_times) / len(first_times), 2)
            
            if total_times:
                perf_data["total_response_time"] = round(sum(total_times) / len(total_times), 2)
            
            if char_speeds:
                perf_data["characters_per_second"] = round(sum(char_speeds) / len(char_speeds), 2)
            
            overall_ranking.append({
                "system_name": system,
                "overall_score": round(final_score, 2),
                "evaluation_count": len(system_evals),
                "answer_count": len(system_answers),
                "performance": perf_data
            })
        
        # 按总分排序
        overall_ranking.sort(key=lambda x: x["overall_score"], reverse=True)
        
        # 分析系统优缺点
        strengths_weaknesses = {}
        
        for system in systems_to_compare:
            system_strengths = []
            system_weaknesses = []
            
            # 根据各个维度的表现确定优缺点
            for dim_comp in dimension_comparisons:
                system_scores = [s for s in dim_comp["systems"] if s["system_name"] == system]
                
                if not system_scores:
                    continue
                
                system_score = system_scores[0]["average_score"]
                all_scores = [s["average_score"] for s in dim_comp["systems"]]
                
                # 如果该维度得分高于其他系统平均分，则为优势
                other_scores = [s for s in all_scores if s != system_score]
                if other_scores and system_score > (sum(other_scores) / len(other_scores) + 0.5):
                    system_strengths.append({
                        "dimension": dim_comp["dimension_name"],
                        "score": system_score,
                        "comparison": f"高于平均分{round(system_score - sum(other_scores) / len(other_scores), 2)}分"
                    })
                
                # 如果该维度得分低于其他系统平均分，则为劣势
                if other_scores and system_score < (sum(other_scores) / len(other_scores) - 0.5):
                    system_weaknesses.append({
                        "dimension": dim_comp["dimension_name"],
                        "score": system_score,
                        "comparison": f"低于平均分{round(sum(other_scores) / len(other_scores) - system_score, 2)}分"
                    })
            
            strengths_weaknesses[system] = {
                "strengths": system_strengths,
                "weaknesses": system_weaknesses
            }
        
        # 构建报告内容
        content = {
            "project_id": str(report.project_id),
            "project_name": project.name,
            "systems": systems_to_compare,
            "question_count": len(questions),
            "dimension_comparisons": dimension_comparisons,
            "overall_ranking": overall_ranking,
            "strengths_weaknesses": strengths_weaknesses,
            "generated_at": datetime.now().isoformat()
        }
        
        return content
    
    def _generate_improvement_suggestions(
        self, 
        dimensions: List[EvaluationDimension],
        dimension_results: List[Dict[str, Any]],
        system_results: List[Dict[str, Any]]
    ) -> List[str]:
        """根据评测结果生成改进建议"""
        suggestions = []
        
        # 找出评分最低的维度
        if dimension_results:
            dimension_results_sorted = sorted(dimension_results, key=lambda x: x["average_score"])
            lowest_dims = dimension_results_sorted[:min(3, len(dimension_results))]
            
            for dim in lowest_dims:
                dim_name = dim["dimension_name"]
                dim_score = dim["average_score"]
                
                if dim_score < 3.5:  # 如果分数低于3.5，提出改进建议
                    suggestions.append(
                        f"在{dim_name}维度的表现较弱（平均分{dim_score}分），建议重点提升相关能力。"
                    )
        
        # 分析系统之间的差异
        if len(system_results) > 1:
            best_system = system_results[0]
            worst_system = system_results[-1]
            
            score_diff = best_system["average_score"] - worst_system["average_score"]
            
            if score_diff > 1.0:  # 如果最好和最差系统差距显著
                suggestions.append(
                    f"系统{best_system['system_name']}的表现显著优于{worst_system['system_name']}，" +
                    f"分差{round(score_diff, 1)}分，建议分析{best_system['system_name']}的优势并应用到其他系统。"
                )
        
        # 如果系统只有一个，给出通用建议
        if len(system_results) == 1:
            system = system_results[0]
            if system["average_score"] < 4.0:
                suggestions.append(
                    f"整体评分为{system['average_score']}分，还有提升空间。建议通过改进检索策略和内容质量来提升性能。"
                )
        
        # 如果没有生成任何建议，添加一个默认建议
        if not suggestions:
            suggestions.append(
                "整体表现良好，建议继续收集更多问答对进行评测，以获得更全面的分析。"
            )
        
        return suggestions
    
    def export_report(
        self, 
        report_id: str,
        export_format: str = "pdf",
        include_charts: bool = True
    ) -> Optional[bytes]:
        """导出报告"""
        report = self.db.query(Report).filter(Report.id == report_id).first()
        if not report or not report.content:
            return None
        
        # 根据不同格式导出报告
        if export_format == "pdf":
            return self._export_as_pdf(report, include_charts)
        elif export_format == "html":
            return self._export_as_html(report, include_charts)
        elif export_format == "md":
            return self._export_as_markdown(report)
        elif export_format in ["csv", "xlsx"]:
            return self._export_as_spreadsheet(report, export_format)
        else:
            return None
    
    def _export_as_pdf(self, report: Report, include_charts: bool) -> bytes:
        """将报告导出为PDF"""
        # 这里实现PDF导出逻辑
        # 可以使用weasyprint, reportlab等库
        # 为简化，这里仅返回示例数据
        return b"PDF content"
    
    def _export_as_html(self, report: Report, include_charts: bool) -> bytes:
        """将报告导出为HTML"""
        # 这里实现HTML导出逻辑
        # 可以使用Jinja2模板引擎
        # 为简化，这里仅返回示例数据
        return b"<html><body><h1>Report</h1></body></html>"
    
    def _export_as_markdown(self, report: Report) -> bytes:
        """将报告导出为Markdown"""
        # 这里实现Markdown导出逻辑
        # 为简化，这里仅返回示例数据
        return b"# Report\n\n## Summary"
    
    def _export_as_spreadsheet(self, report: Report, format: str) -> bytes:
        """将报告导出为CSV或Excel"""
        # 这里实现CSV/Excel导出逻辑
        # 可以使用pandas库
        # 为简化，这里仅返回示例数据
        return b"data,value\nrow1,10" 