from django.urls import path

from . import reports, views

urlpatterns = [
    # public ingestion
    path('analytics/pageview/', views.pageview_ingest, name='analytics_pageview'),

    # admin reports
    path('admin/reports/sales-by-country/', reports.sales_by_country, name='report_sales_by_country'),
    path('admin/reports/revenue-by-product/', reports.revenue_by_product, name='report_revenue_by_product'),
    path('admin/reports/clv/', reports.clv, name='report_clv'),
    path('admin/reports/repeat-cohort/', reports.repeat_cohort, name='report_repeat_cohort'),
    path('admin/reports/abandoned-conversion/', reports.abandoned_conversion, name='report_abandoned_conversion'),
    path('admin/reports/revenue-trend/', reports.revenue_trend, name='report_revenue_trend'),
    path('admin/reports/conversion-funnel/', reports.conversion_funnel, name='report_conversion_funnel'),
]
