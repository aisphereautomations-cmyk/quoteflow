'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './admin.module.css';

interface PromoCode {
    id: string;
    code: string;
    type: 'percentage_discount' | 'fixed_discount' | 'free_days';
    value: number;
    max_uses: number | null;
    times_used: number;
    valid_from: string;
    valid_until: string | null;
    applies_to_plans: string[];
    is_active: boolean;
    created_at: string;
}

const EMPTY_FORM: FormState = {
    code: '',
    type: 'percentage_discount',
    value: '',
    maxUses: '',
    validUntil: '',
    appliesTo: ['starter', 'pro', 'enterprise'],
};

interface FormState {
    code: string;
    type: 'percentage_discount' | 'fixed_discount' | 'free_days';
    value: string;
    maxUses: string;
    validUntil: string;
    appliesTo: string[];
}

export default function AdminPromoPage() {
    const router = useRouter();
    const [promos, setPromos] = useState<PromoCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const fetchPromos = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/promo');
            if (res.status === 403) {
                router.push('/main');
                return;
            }
            const data = await res.json();
            if (Array.isArray(data)) setPromos(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { fetchPromos(); }, [fetchPromos]);

    const handleSubmit = async () => {
        if (!form.code || !form.value) {
            setError('Code and value are required');
            return;
        }

        const body = {
            ...(editingId ? { id: editingId } : {}),
            code: form.code,
            type: form.type,
            value: parseFloat(form.value),
            maxUses: form.maxUses ? parseInt(form.maxUses) : null,
            validUntil: form.validUntil || null,
            appliesTo: form.appliesTo,
        };

        const res = await fetch('/api/admin/promo', {
            method: editingId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (data.error) {
            setError(data.error);
            return;
        }

        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        setError('');
        fetchPromos();
    };

    const handleEdit = (promo: PromoCode) => {
        setForm({
            code: promo.code,
            type: promo.type,
            value: String(promo.value),
            maxUses: promo.max_uses ? String(promo.max_uses) : '',
            validUntil: promo.valid_until ? promo.valid_until.split('T')[0] : '',
            appliesTo: promo.applies_to_plans,
        });
        setEditingId(promo.id);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this promo code?')) return;
        await fetch('/api/admin/promo', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        fetchPromos();
    };

    const handleToggle = async (promo: PromoCode) => {
        await fetch('/api/admin/promo', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: promo.id, isActive: !promo.is_active }),
        });
        fetchPromos();
    };

    const togglePlan = (plan: string) => {
        setForm(prev => ({
            ...prev,
            appliesTo: prev.appliesTo.includes(plan)
                ? prev.appliesTo.filter(p => p !== plan)
                : [...prev.appliesTo, plan],
        }));
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'percentage_discount': return '% Off';
            case 'fixed_discount': return '€ Off';
            case 'free_days': return 'Free Days';
            default: return type;
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Promo Codes</h1>
                    <p className={styles.subtitle}>{promos.length} codes total</p>
                </div>
                <div className={styles.headerActions}>
                    <button className={styles.backBtn} onClick={() => router.push('/main')}>
                        ← Back
                    </button>
                    <button
                        className={styles.createBtn}
                        onClick={() => {
                            setForm(EMPTY_FORM);
                            setEditingId(null);
                            setShowForm(true);
                        }}
                    >
                        + New Code
                    </button>
                </div>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className={styles.formCard}>
                    <h3 className={styles.formTitle}>
                        {editingId ? 'Edit Promo Code' : 'Create Promo Code'}
                    </h3>

                    {error && <p className={styles.formError}>{error}</p>}

                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label>Code</label>
                            <input
                                type="text"
                                value={form.code}
                                onChange={(e) => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                placeholder="e.g. LAUNCH50"
                                className={styles.formInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Type</label>
                            <select
                                value={form.type}
                                onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value as typeof form.type }))}
                                className={styles.formInput}
                            >
                                <option value="percentage_discount">Percentage Discount (%)</option>
                                <option value="fixed_discount">Fixed Discount (€)</option>
                                <option value="free_days">Free Trial (days)</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>
                                Value {form.type === 'percentage_discount' ? '(%)' : form.type === 'fixed_discount' ? '(€)' : '(days)'}
                            </label>
                            <input
                                type="number"
                                value={form.value}
                                onChange={(e) => setForm(prev => ({ ...prev, value: e.target.value }))}
                                placeholder={form.type === 'free_days' ? 'e.g. 14' : 'e.g. 50'}
                                className={styles.formInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Max Uses (empty = unlimited)</label>
                            <input
                                type="number"
                                value={form.maxUses}
                                onChange={(e) => setForm(prev => ({ ...prev, maxUses: e.target.value }))}
                                placeholder="Unlimited"
                                className={styles.formInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Expires (optional)</label>
                            <input
                                type="date"
                                value={form.validUntil}
                                onChange={(e) => setForm(prev => ({ ...prev, validUntil: e.target.value }))}
                                className={styles.formInput}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Applies to Plans</label>
                            <div className={styles.planToggleGroup}>
                                {['starter', 'pro', 'enterprise'].map((plan) => (
                                    <button
                                        key={plan}
                                        type="button"
                                        className={`${styles.planToggle} ${form.appliesTo.includes(plan) ? styles.planToggleActive : ''}`}
                                        onClick={() => togglePlan(plan)}
                                    >
                                        {plan.charAt(0).toUpperCase() + plan.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className={styles.formActions}>
                        <button className={styles.cancelBtn} onClick={() => { setShowForm(false); setEditingId(null); setError(''); }}>
                            Cancel
                        </button>
                        <button className={styles.saveBtn} onClick={handleSubmit}>
                            {editingId ? 'Update' : 'Create'} Code
                        </button>
                    </div>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <p className={styles.loading}>Loading...</p>
            ) : promos.length === 0 ? (
                <p className={styles.empty}>No promo codes yet. Create your first one!</p>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Type</th>
                                <th>Value</th>
                                <th>Uses</th>
                                <th>Expires</th>
                                <th>Plans</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {promos.map((promo) => (
                                <tr key={promo.id} className={!promo.is_active ? styles.rowInactive : ''}>
                                    <td className={styles.codeCell}>{promo.code}</td>
                                    <td>{getTypeLabel(promo.type)}</td>
                                    <td>
                                        {promo.type === 'percentage_discount' ? `${promo.value}%` :
                                            promo.type === 'fixed_discount' ? `€${promo.value}` :
                                                `${promo.value} days`}
                                    </td>
                                    <td>{promo.times_used}{promo.max_uses ? ` / ${promo.max_uses}` : ''}</td>
                                    <td>{promo.valid_until ? new Date(promo.valid_until).toLocaleDateString() : '—'}</td>
                                    <td>{promo.applies_to_plans.map(p => p.charAt(0).toUpperCase()).join(', ')}</td>
                                    <td>
                                        <button
                                            className={`${styles.statusBadge} ${promo.is_active ? styles.statusActive : styles.statusInactive}`}
                                            onClick={() => handleToggle(promo)}
                                        >
                                            {promo.is_active ? 'Active' : 'Off'}
                                        </button>
                                    </td>
                                    <td className={styles.actionsCell}>
                                        <button className={styles.editBtn} onClick={() => handleEdit(promo)}>✏️</button>
                                        <button className={styles.deleteBtn} onClick={() => handleDelete(promo.id)}>🗑</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
